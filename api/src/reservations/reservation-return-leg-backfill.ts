import { Prisma, PrismaClient, ReservationStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { withUpdateAudit } from '../prisma/audit-write.helper';
import { phoneKeyForIdentity } from '../passengers/passenger-match.util';
import { LEGACY_RETURN_LOOKUP_DAYS } from './return-leg-link';

/**
 * Pairs the return legs that were booked before `returnOfReservationId`
 * existed.
 *
 * Two phases, in this order. Phase A is exact: rows already sharing a
 * `roundTripId` were sold together, so pairing inside that set asserts
 * nothing the data does not already say. Phase B is the bounded heuristic
 * `cancellationPreview` has trusted all along (same passenger, reversed
 * stations, inside the lookup window) applied to rows carrying no marker at
 * all.
 *
 * Two rules matter more than the match rate:
 *
 * - **Cancelled rows are in scope.** The preview filters to ACTIVE; this must
 *   not, or it would skip exactly the half-cancelled pairs the new check
 *   exists to find.
 * - **Ambiguity is never resolved here.** More than one candidate, or a
 *   candidate some other row already took, leaves the row unlinked and
 *   reported. A wrong link sends staff to phone a passenger about a journey
 *   that was never sold, which is worse than no link at all.
 */

const MAX_LINKS_PER_TRANSACTION = 100;
const DAY_IN_MS = 86_400_000;
/**
 * A leg cancelled this soon after it was booked was a mis-entry corrected on
 * the spot, not a journey somebody lost. On the production data the six such
 * rows all died within 7 minutes and the next one took 48, so the line is
 * drawn with room on both sides.
 */
const ENTRY_CORRECTION_MINUTES = 15;

type BackfillPhase = 'exact' | 'heuristic';

export type ReturnLegExclusionReason =
  /** Cancelled, but the passenger still holds a live seat on that departure. */
  | 'reseated_or_partly_cancelled'
  /** Cancelled, but somebody on the same phone holds a live seat on it. */
  | 'seat_held_under_another_row'
  /** Cancelled within minutes of being booked. */
  | 'entry_correction';

export interface ReturnLegExclusion {
  tenantId: string;
  reservationId: string;
  reason: ReturnLegExclusionReason;
}

export type ReturnLegAmbiguityReason =
  /** Several outbound legs fit, and the seat number does not break the tie. */
  | 'multiple_candidates'
  /** Every outbound leg that fits was already paired with another return. */
  | 'candidates_already_paired';

export interface ReturnLegBackfillLink {
  phase: BackfillPhase;
  tenantId: string;
  returnReservationId: string;
  outboundReservationId: string;
  /**
   * The booking marker both rows end up carrying. Phase A reuses the one they
   * already share; phase B mints one, because a pair that reaches the agency
   * through a backfill should be indistinguishable from one booked today.
   */
  roundTripId: string;
}

export interface ReturnLegBackfillAmbiguity {
  phase: BackfillPhase;
  tenantId: string;
  reservationId: string;
  reason: ReturnLegAmbiguityReason;
  candidateReservationIds: string[];
}

export interface ReturnLegBackfillCounts {
  reservationsRead: number;
  alreadyLinked: number;
  exactMatches: number;
  heuristicMatches: number;
  ambiguous: number;
  /** Cancelled rows held back because they are not the leg they look like. */
  excluded: number;
  /** Unlinked rows the backfill leaves alone — one-way tickets, mostly. */
  unmatched: number;
}

export interface ReturnLegBackfillPlan {
  links: ReturnLegBackfillLink[];
  ambiguous: ReturnLegBackfillAmbiguity[];
  excluded: ReturnLegExclusion[];
  counts: ReturnLegBackfillCounts;
}

export interface ReturnLegBackfillResult {
  linkedCount: number;
  exactCount: number;
  heuristicCount: number;
  /** Rows another writer linked between the plan and the write. */
  skippedCount: number;
}

const BACKFILL_SELECT = Prisma.validator<Prisma.ReservationSelect>()({
  id: true,
  tenantId: true,
  passengerId: true,
  travelDate: true,
  rideDepartureTime: true,
  seatNumber: true,
  status: true,
  departureStationId: true,
  arrivalStationId: true,
  roundTripId: true,
  returnOfReservationId: true,
  rideId: true,
  createdAt: true,
  cancelledAt: true,
  passenger: { select: { phone: true } }
});

type BackfillRow = Prisma.ReservationGetPayload<{ select: typeof BACKFILL_SELECT }>;

type PrismaReadClient = Pick<PrismaClient, 'reservation'>;

function departsBefore(left: BackfillRow, right: BackfillRow): boolean {
  const leftDate = left.travelDate.getTime();
  const rightDate = right.travelDate.getTime();

  return leftDate !== rightDate
    ? leftDate < rightDate
    : left.rideDepartureTime < right.rideDepartureTime;
}

function isReversed(leg: BackfillRow, outbound: BackfillRow): boolean {
  return (
    outbound.departureStationId === leg.arrivalStationId &&
    outbound.arrivalStationId === leg.departureStationId
  );
}

/**
 * Narrows a candidate set two ways the agency's own data justifies, in order.
 *
 * A cancelled leg with a live alternative for the same journey was replaced,
 * not lost — the passenger rebooked. Pairing the dead one would report a
 * broken round trip to staff who already fixed it. When no live alternative
 * exists the cancelled leg is the only candidate, so a genuinely half-dead
 * pair is still linked and still flagged.
 *
 * Then the seat, which a round trip usually keeps in both directions. Only a
 * preference: the orphan repair in #14 reseated 40 reservations whose seats
 * had been resold while they were invisible, so a seat mismatch says as much
 * about that incident as about the passenger.
 *
 * Anything still tied is left for a human.
 */
function resolveCandidate(leg: BackfillRow, candidates: BackfillRow[]): BackfillRow | null {
  if (candidates.length <= 1) {
    return candidates[0] ?? null;
  }

  const live = candidates.filter((candidate) => candidate.status === ReservationStatus.ACTIVE);
  const narrowed = live.length > 0 ? live : candidates;
  if (narrowed.length === 1) {
    return narrowed[0];
  }

  const sameSeat = narrowed.filter((candidate) => candidate.seatNumber === leg.seatNumber);

  return sameSeat.length === 1 ? sameSeat[0] : null;
}

/**
 * Live legs choose first. Two return legs can fit one outbound leg when a
 * passenger cancelled a return and booked another, and whichever is processed
 * first takes it; the one still standing is the one that means something.
 */
function liveLegsFirst(legs: BackfillRow[]): BackfillRow[] {
  return [
    ...legs.filter((leg) => leg.status === ReservationStatus.ACTIVE),
    ...legs.filter((leg) => leg.status !== ReservationStatus.ACTIVE)
  ];
}

/**
 * Reads the whole plan without writing anything, so it can be run against a
 * restored production backup before anyone supplies an actor id. The counts it
 * returns are what gate 4 of the epic compares between the restored run and
 * the production run.
 */
/**
 * One pass over the current state of the rows. Both phases, in order.
 */
function pairingPass(rows: BackfillRow[]): {
  links: ReturnLegBackfillLink[];
  ambiguous: ReturnLegBackfillAmbiguity[];
} {
  const links: ReturnLegBackfillLink[] = [];
  const ambiguous: ReturnLegBackfillAmbiguity[] = [];

  // An outbound leg any row already points at is out of reach, and so is one
  // this pass has just handed to another return leg.
  const takenOutboundIds = new Set(
    rows.map((row) => row.returnOfReservationId).filter((id): id is string => Boolean(id))
  );

  const record = (
    phase: BackfillPhase,
    leg: BackfillRow,
    reachable: BackfillRow[],
    available: BackfillRow[]
  ): BackfillRow | null => {
    if (reachable.length === 0) {
      return null;
    }

    if (available.length === 0) {
      ambiguous.push({
        phase,
        tenantId: leg.tenantId,
        reservationId: leg.id,
        reason: 'candidates_already_paired',
        candidateReservationIds: reachable.map((candidate) => candidate.id)
      });
      return null;
    }

    const resolved = resolveCandidate(leg, available);
    if (!resolved) {
      ambiguous.push({
        phase,
        tenantId: leg.tenantId,
        reservationId: leg.id,
        reason: 'multiple_candidates',
        candidateReservationIds: available.map((candidate) => candidate.id)
      });
      return null;
    }

    return resolved;
  };

  // Phase A — rows sold together, according to the marker they already share.
  const bookings = new Map<string, BackfillRow[]>();
  for (const row of rows) {
    if (!row.roundTripId) {
      continue;
    }

    const key = `${row.tenantId}:${row.roundTripId}`;
    const booking = bookings.get(key);
    if (booking) {
      booking.push(row);
    } else {
      bookings.set(key, [row]);
    }
  }

  for (const booking of bookings.values()) {
    for (const leg of liveLegsFirst(booking)) {
      if (leg.returnOfReservationId !== null) {
        continue;
      }

      const reachable = booking.filter(
        (candidate) =>
          candidate.id !== leg.id &&
          candidate.passengerId === leg.passengerId &&
          isReversed(leg, candidate) &&
          departsBefore(candidate, leg)
      );
      const outbound = record(
        'exact',
        leg,
        reachable,
        reachable.filter((candidate) => !takenOutboundIds.has(candidate.id))
      );

      if (outbound) {
        takenOutboundIds.add(outbound.id);
        links.push({
          phase: 'exact',
          tenantId: leg.tenantId,
          returnReservationId: leg.id,
          outboundReservationId: outbound.id,
          // Both rows already carry it; this is the marker, not a new one.
          roundTripId: leg.roundTripId as string
        });
      }
    }
  }

  // Phase B — rows carrying no marker and no link, where nothing but the
  // shape of the journey says the two belong together. A row that gets paired
  // here leaves the pool: a legacy pair is exactly two rows, and this is no
  // place to invent a chain of them.
  const legacy = rows.filter((row) => !row.roundTripId && row.returnOfReservationId === null);
  const paired = new Set<string>();
  const byPassenger = new Map<string, BackfillRow[]>();
  for (const row of legacy) {
    const key = `${row.tenantId}:${row.passengerId}`;
    const bucket = byPassenger.get(key);
    if (bucket) {
      bucket.push(row);
    } else {
      byPassenger.set(key, [row]);
    }
  }

  for (const leg of liveLegsFirst(legacy)) {
    if (paired.has(leg.id)) {
      continue;
    }

    const reachable = (byPassenger.get(`${leg.tenantId}:${leg.passengerId}`) ?? []).filter(
      (candidate) =>
        candidate.id !== leg.id &&
        isReversed(leg, candidate) &&
        departsBefore(candidate, leg) &&
        leg.travelDate.getTime() - candidate.travelDate.getTime() <=
          LEGACY_RETURN_LOOKUP_DAYS * DAY_IN_MS
    );
    const outbound = record(
      'heuristic',
      leg,
      reachable,
      reachable.filter(
        (candidate) => !takenOutboundIds.has(candidate.id) && !paired.has(candidate.id)
      )
    );

    if (outbound) {
      takenOutboundIds.add(outbound.id);
      paired.add(outbound.id);
      paired.add(leg.id);
      links.push({
        phase: 'heuristic',
        tenantId: leg.tenantId,
        returnReservationId: leg.id,
        outboundReservationId: outbound.id,
        roundTripId: randomUUID()
      });
    }
  }

  return { links, ambiguous };
}

/**
 * Cancelled rows that are not the leg they look like.
 *
 * Three shapes, all found in production and all of which would otherwise be
 * paired with a live outbound leg and reported as a broken round trip:
 *
 * - **Reseated or partly cancelled.** The passenger still holds a live seat on
 *   that very departure. #14 reseated 40 reservations whose seats had been
 *   resold while they were invisible, cancelling the old rows; and a party
 *   that gives up one of several seats keeps travelling. #79 is explicit that
 *   this shape must not be flagged.
 * - **Held under another row.** Somebody on the same phone holds a live seat
 *   on that departure. A couple's two return seats ended up under one of the
 *   two names and the other's rows were cancelled, confirmed with the agency.
 *   This deliberately does not merge the two people: a shared phone with
 *   different names is a family, not a duplicate.
 * - **Entry correction.** Booked and cancelled minutes apart, which is
 *   somebody fixing a mistake, not a passenger losing a journey.
 */
function excludedLegs(rows: BackfillRow[]): Map<string, ReturnLegExclusionReason> {
  const departureKey = (row: BackfillRow): string =>
    `${row.tenantId}:${row.rideId}:${row.travelDate.getTime()}:${row.rideDepartureTime}`;

  const liveByDeparture = new Map<string, BackfillRow[]>();
  for (const row of rows) {
    if (row.status !== ReservationStatus.ACTIVE) {
      continue;
    }

    const key = departureKey(row);
    const seats = liveByDeparture.get(key);
    if (seats) {
      seats.push(row);
    } else {
      liveByDeparture.set(key, [row]);
    }
  }

  const excluded = new Map<string, ReturnLegExclusionReason>();

  for (const row of rows) {
    if (row.status !== ReservationStatus.CANCELLED) {
      continue;
    }

    if (
      row.cancelledAt &&
      row.cancelledAt.getTime() - row.createdAt.getTime() <= ENTRY_CORRECTION_MINUTES * 60_000
    ) {
      excluded.set(row.id, 'entry_correction');
      continue;
    }

    const live = liveByDeparture.get(departureKey(row)) ?? [];
    if (live.some((seat) => seat.passengerId === row.passengerId)) {
      excluded.set(row.id, 'reseated_or_partly_cancelled');
      continue;
    }

    const phone = phoneKeyForIdentity(row.passenger.phone);
    if (
      phone.length === 8 &&
      live.some((seat) => phoneKeyForIdentity(seat.passenger.phone) === phone)
    ) {
      excluded.set(row.id, 'seat_held_under_another_row');
    }
  }

  return excluded;
}

/**
 * Passes repeat until nothing new is found, because a pass changes what the
 * next one can see: a paired row leaves the pool, which can leave a single
 * candidate where two competed, and a marker minted in phase B moves its pair
 * out of phase B's reach. Running to that fixed point here is what makes a
 * second run of the script a genuine no-op, so the production run can be
 * compared against the restored-backup run.
 */
const MAX_PASSES = 10;

/**
 * Reads the whole plan without writing anything, so it can be run against a
 * restored production backup before anyone supplies an actor id. The counts it
 * returns are what gate 4 of the epic compares between the restored run and
 * the production run.
 */
export async function planReturnLegBackfill(
  prisma: PrismaReadClient
): Promise<ReturnLegBackfillPlan> {
  const rows = await prisma.reservation.findMany({
    select: BACKFILL_SELECT,
    orderBy: [{ travelDate: 'asc' }, { rideDepartureTime: 'asc' }, { id: 'asc' }]
  });
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const alreadyLinked = rows.filter((row) => row.returnOfReservationId !== null).length;

  // Held back before anything is paired, so they are neither a leg nor a
  // candidate for one. The outbound leg they would have claimed simply stays
  // unlinked, which is the right answer: nothing was lost.
  const exclusions = excludedLegs(rows);
  const considered = rows.filter((row) => !exclusions.has(row.id));
  const excluded: ReturnLegExclusion[] = rows
    .filter((row) => exclusions.has(row.id))
    .map((row) => ({
      tenantId: row.tenantId,
      reservationId: row.id,
      reason: exclusions.get(row.id) as ReturnLegExclusionReason
    }));

  const links: ReturnLegBackfillLink[] = [];
  // Kept across passes and keyed by row, so the pass that saw the competition
  // is the one that describes it. Entries a later pass resolved are dropped
  // below rather than reported as open questions.
  const ambiguousByRow = new Map<string, ReturnLegBackfillAmbiguity>();

  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const result = pairingPass(considered);
    for (const entry of result.ambiguous) {
      if (!ambiguousByRow.has(entry.reservationId)) {
        ambiguousByRow.set(entry.reservationId, entry);
      }
    }

    if (result.links.length === 0) {
      break;
    }

    for (const link of result.links) {
      const leg = rowsById.get(link.returnReservationId);
      const outbound = rowsById.get(link.outboundReservationId);
      if (leg) {
        leg.returnOfReservationId = link.outboundReservationId;
        leg.roundTripId = link.roundTripId;
      }
      if (outbound) {
        outbound.roundTripId = link.roundTripId;
      }
      links.push(link);
    }
  }

  const exactMatches = links.filter((link) => link.phase === 'exact').length;
  const touched = new Set(
    links.flatMap((link) => [link.returnReservationId, link.outboundReservationId])
  );
  const ambiguous = [...ambiguousByRow.values()].filter((entry) => !touched.has(entry.reservationId));
  const reported = new Set(ambiguous.map((entry) => entry.reservationId));
  const unmatched = considered.filter(
    (row) => !touched.has(row.id) && !reported.has(row.id) && row.returnOfReservationId === null
  ).length;

  return {
    links,
    ambiguous,
    excluded,
    counts: {
      reservationsRead: rows.length,
      alreadyLinked,
      exactMatches,
      heuristicMatches: links.length - exactMatches,
      ambiguous: ambiguous.length,
      excluded: excluded.length,
      unmatched
    }
  };
}

/**
 * Writes the links a plan found. Every update is guarded on the row still
 * being unlinked, so an interrupted run can simply be repeated and a row some
 * other writer claimed in the meantime is skipped rather than overwritten.
 */
export async function applyReturnLegBackfill(
  prisma: PrismaClient,
  actorId: string,
  plan?: ReturnLegBackfillPlan
): Promise<ReturnLegBackfillResult> {
  if (!actorId?.trim()) {
    throw new Error('actor user id is required for the reservation return leg backfill');
  }

  const resolved = plan ?? (await planReturnLegBackfill(prisma));
  const result: ReturnLegBackfillResult = {
    linkedCount: 0,
    exactCount: 0,
    heuristicCount: 0,
    skippedCount: 0
  };

  for (let start = 0; start < resolved.links.length; start += MAX_LINKS_PER_TRANSACTION) {
    const chunk = resolved.links.slice(start, start + MAX_LINKS_PER_TRANSACTION);

    const written = await prisma.$transaction(async (tx) => {
      const applied: ReturnLegBackfillLink[] = [];

      for (const link of chunk) {
        const linked = await tx.reservation.updateMany({
          where: {
            id: link.returnReservationId,
            tenantId: link.tenantId,
            returnOfReservationId: null
          },
          data: withUpdateAudit(
            {
              returnOfReservationId: link.outboundReservationId,
              roundTripId: link.roundTripId
            },
            actorId
          )
        });

        if (linked.count === 0) {
          continue;
        }

        // Phase A leaves this a no-op — the outbound already carries the
        // marker. Phase B is where the one-way leg becomes a round trip.
        const marked = await tx.reservation.updateMany({
          where: {
            id: link.outboundReservationId,
            tenantId: link.tenantId,
            roundTripId: null
          },
          data: withUpdateAudit({ roundTripId: link.roundTripId }, actorId)
        });
        if (link.phase === 'heuristic' && marked.count === 0) {
          throw new Error('outbound reservation was claimed after the backfill plan was read');
        }

        applied.push(link);
      }

      return applied;
    });

    result.linkedCount += written.length;
    result.exactCount += written.filter((link) => link.phase === 'exact').length;
    result.heuristicCount += written.filter((link) => link.phase === 'heuristic').length;
    result.skippedCount += chunk.length - written.length;
  }

  return result;
}
