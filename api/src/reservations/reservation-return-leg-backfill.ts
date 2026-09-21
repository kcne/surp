import { Prisma, PrismaClient, ReservationStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { withUpdateAudit } from '../prisma/audit-write.helper';
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

type BackfillPhase = 'exact' | 'heuristic';

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
  /** Unlinked rows the backfill leaves alone — one-way tickets, mostly. */
  unmatched: number;
}

export interface ReturnLegBackfillPlan {
  links: ReturnLegBackfillLink[];
  ambiguous: ReturnLegBackfillAmbiguity[];
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
  returnOfReservationId: true
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
export async function planReturnLegBackfill(
  prisma: PrismaReadClient
): Promise<ReturnLegBackfillPlan> {
  const rows = await prisma.reservation.findMany({
    select: BACKFILL_SELECT,
    orderBy: [{ travelDate: 'asc' }, { rideDepartureTime: 'asc' }, { id: 'asc' }]
  });

  const links: ReturnLegBackfillLink[] = [];
  const ambiguous: ReturnLegBackfillAmbiguity[] = [];

  // An outbound leg any row already points at is out of reach, and so is one
  // this run has just handed to another return leg.
  const takenOutboundIds = new Set(
    rows
      .map((row) => row.returnOfReservationId)
      .filter((id): id is string => Boolean(id))
  );
  const alreadyLinked = rows.filter((row) => row.returnOfReservationId !== null).length;

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

  for (const leg of liveLegsFirst(legacy)) {
    if (paired.has(leg.id)) {
      continue;
    }

    const reachable = legacy.filter(
      (candidate) =>
        candidate.id !== leg.id &&
        candidate.tenantId === leg.tenantId &&
        candidate.passengerId === leg.passengerId &&
        isReversed(leg, candidate) &&
        departsBefore(candidate, leg) &&
        leg.travelDate.getTime() - candidate.travelDate.getTime() <=
          LEGACY_RETURN_LOOKUP_DAYS * DAY_IN_MS
    );
    const outbound = record(
      'heuristic',
      leg,
      reachable,
      reachable.filter((candidate) => !takenOutboundIds.has(candidate.id) && !paired.has(candidate.id))
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

  const exactMatches = links.filter((link) => link.phase === 'exact').length;
  // Counted at the end rather than as rows are visited: an outbound leg is
  // reached before the return that pairs with it, and looks candidate-less
  // until then.
  const touched = new Set(
    links.flatMap((link) => [link.returnReservationId, link.outboundReservationId])
  );
  const reported = new Set(ambiguous.map((entry) => entry.reservationId));
  const unmatched = rows.filter(
    (row) => row.returnOfReservationId === null && !touched.has(row.id) && !reported.has(row.id)
  ).length;

  return {
    links,
    ambiguous,
    counts: {
      reservationsRead: rows.length,
      alreadyLinked,
      exactMatches,
      heuristicMatches: links.length - exactMatches,
      ambiguous: ambiguous.length,
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
        await tx.reservation.updateMany({
          where: {
            id: link.outboundReservationId,
            tenantId: link.tenantId,
            roundTripId: null
          },
          data: withUpdateAudit({ roundTripId: link.roundTripId }, actorId)
        });

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
