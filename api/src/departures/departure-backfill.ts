import { DepartureSource, Prisma, ReservationStatus, RideExceptionType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ScheduleLockRoot, scheduleEditTransaction } from '../prisma/schedule-lock';
import { formatDateOnly, utcDateOf } from '../rides/ride-instance-materialization';
import { addDays, agencyDate, resolveAgencyTimezone } from './agency-date';
import {
  GeneratorRide,
  PlannedCancellation,
  PlannedDeparture,
  extraKey,
  generateDepartures,
  planExtra,
  rideRuns,
  scheduleKey
} from './departure-generator';
import { LINKABLE_SOURCES } from './departure-link';
import {
  DepartureSyncScope,
  insertPlannedDepartures,
  loadRides,
  planDepartureSync
} from './departure-sync';
import { SYSTEM_ACTOR_ID } from './system-actor';

/**
 * Links the reservations booked before PR 1b to their departures (#27, PR 2).
 *
 * A past departure is written the way a future one is, and a reservation is
 * linked by the same rule however old it is:
 *
 * 1. History. The generator runs over the past dates of unlinked reservations,
 *    and every departure it produces that one of them matches, and that is not
 *    stored yet, is written the way the sync writes one. The generator reads
 *    today's timetable, so the departure time is the one the reservation was
 *    sold with (that is what it matched on), while the arrival time, stops and
 *    capacity are today's, not necessarily what ran on that day.
 * 2. Link. Each unlinked reservation, whatever its date or status, takes the
 *    one SCHEDULE or EXTRA departure with its ride, date and exact departure
 *    time (`resolveDepartureLink`, the rule bookings use).
 * 3. Leftovers. With no such departure, a past or cancelled reservation goes
 *    on the LEGACY departure of its ride, date and time: a sale the timetable
 *    no longer produces. A future active one is reported for staff. With
 *    several, the reservation is reported at any date, because a LEGACY row
 *    would put a third bus at a time that already has two; staff choose the
 *    bus and `manualLinks` applies the choice.
 *
 * An existing link is never rewritten, and a stored departure never changed:
 * a stored LEGACY departure that more reservations join keeps its capacity,
 * and seats above it or sold twice on it are reported instead.
 *
 * The plan is a pure function of what is stored, so the dry run reports
 * exactly what the apply writes.
 */

type Db = PrismaService | Prisma.TransactionClient;

export type BackfillReason = 'NO_DEPARTURE' | 'SEVERAL_DEPARTURES';

export type LinkVia = 'EXISTING' | 'HISTORY' | 'LEGACY' | 'MANUAL';

export interface BackfillReservation {
  id: string;
  rideId: string;
  /** `YYYY-MM-DD`. */
  travelDate: string;
  rideDepartureTime: string;
  rideArrivalTime: string;
  seatNumber: number;
  status: ReservationStatus;
  createdAt: Date;
}

export interface BackfillStoredDeparture {
  id: string;
  source: DepartureSource;
  rideId: string;
  /** `YYYY-MM-DD`. */
  serviceDate: string;
  departureTime: string;
  rideExceptionId: string | null;
  capacity: number;
}

export interface BackfillRide {
  id: string;
  lineId: string;
  capacity: number;
}

/** A bus staff chose for a reservation that matches several. */
export interface ManualLink {
  reservationId: string;
  departureId: string;
}

export interface BackfillInput {
  /** The agency's date, `YYYY-MM-DD`. Earlier dates are past. */
  agencyDate: string;
  /** Reservations without a departure. */
  reservations: readonly BackfillReservation[];
  /** Stored departures, of every source, on the reservations' dates. */
  stored: readonly BackfillStoredDeparture[];
  /** The generator's departures on past dates. */
  history: readonly PlannedDeparture[];
  rides: readonly BackfillRide[];
  /** Seats of the active reservations already on stored LEGACY departures. */
  legacySeats?: ReadonlyArray<{ departureId: string; seatNumber: number }>;
  manualLinks?: readonly ManualLink[];
  /**
   * The links the reservations `manualLinks` name already carry, so a manual
   * link a previous run applied is recognised as done rather than refused.
   */
  linked?: ReadonlyArray<{ reservationId: string; departureId: string }>;
  newId?: () => string;
}

export interface PlannedLink {
  reservationId: string;
  departureId: string;
  via: LinkVia;
}

export interface PlannedLegacyDeparture {
  id: string;
  rideId: string;
  serviceDate: string;
  departureTime: string;
  arrivalTime: string;
  lineId: string;
  capacity: number;
  reservationIds: string[];
  /** Every arrival time the key's reservations carry, when there is more than one. */
  arrivalTimesDisagree: string[];
  /** Seats sold twice among the key's active reservations: two buses merged. */
  duplicateSeats: number[];
}

export interface ReportedReservation {
  reservationId: string;
  reason: BackfillReason;
  /** Active and dated on or after the agency date: what PR 3's gate counts. */
  futureActive: boolean;
  rideId: string;
  travelDate: string;
  rideDepartureTime: string;
  status: ReservationStatus;
  candidateIds: string[];
}

export interface ReusedLegacyDeparture {
  id: string;
  reservationIds: string[];
  /** Seats sold on it above its stored capacity, which is left as it is. */
  seatsAboveCapacity: number[];
  /** Seats sold twice among its active reservations, old and joining. */
  duplicateSeats: number[];
}

export interface InvalidManualLink extends ManualLink {
  problem: string;
}

export interface DepartureBackfillPlan {
  agencyDate: string;
  historyCreates: Array<{ id: string; departure: PlannedDeparture }>;
  legacyCreates: PlannedLegacyDeparture[];
  /** Stored LEGACY departures that more reservations join. */
  legacyReused: ReusedLegacyDeparture[];
  links: PlannedLink[];
  reported: ReportedReservation[];
  /** Manual links an earlier run already applied: nothing left to do. */
  manualLinksDone: number;
  invalidManualLinks: InvalidManualLink[];
}

export interface DepartureBackfillCounts {
  historyCreated: number;
  legacyCreated: number;
  /** LEGACY departures created on or after the agency date. */
  legacyCreatedFuture: number;
  legacyReused: number;
  linked: Record<LinkVia, number>;
  reported: Record<BackfillReason, { futureActive: number; other: number }>;
  legacyArrivalDisagreements: number;
  /** LEGACY departures, created or reused, with a seat sold twice. */
  legacyDuplicateSeats: number;
  /** Reused LEGACY departures with a seat sold above their capacity. */
  legacyReusedOverCapacity: number;
  manualLinksDone: number;
  invalidManualLinks: number;
}

export interface HistoryException {
  id: string;
  rideId: string;
  /** `YYYY-MM-DD`. */
  exceptionDate: string;
  type: RideExceptionType;
  departureTime: string | null;
  arrivalTime: string | null;
  createdAt: Date;
  createdById: string | null;
  updatedById: string | null;
}

/**
 * A SKIP without an author still cancelled the date, as it hid the date from
 * the materializer. The audit trigger refuses such a row today, but the schema
 * allows it, so it is credited to the system actor rather than dropped.
 */
function cancellationOf(skip: HistoryException | undefined): PlannedCancellation | null {
  if (!skip) {
    return null;
  }

  return { at: skip.createdAt, by: skip.updatedById ?? skip.createdById ?? SYSTEM_ACTOR_ID };
}

/**
 * What ran on past dates. The sync no longer reads exceptions (#27, PR 3a),
 * but for a date that is gone the exception rows are the record of what was
 * cancelled and which extra buses ran, so the backfill reads them here: a SKIP
 * cancels the timetable departure, and an ADDITIONAL with both times is an
 * extra bus, keyed by its exception.
 */
export function generateHistory(
  rides: readonly GeneratorRide[],
  exceptions: readonly HistoryException[],
  from: string,
  to: string
): PlannedDeparture[] {
  const inWindow = exceptions.filter(
    (exception) => exception.exceptionDate >= from && exception.exceptionDate <= to
  );
  const skips = new Map<string, HistoryException>();

  for (const exception of inWindow) {
    const key = `${exception.rideId}:${exception.exceptionDate}`;

    // The first SKIP on a date, in the order they were loaded.
    if (exception.type === RideExceptionType.SKIP && !skips.has(key)) {
      skips.set(key, exception);
    }
  }

  const scheduled = generateDepartures(rides, from, to).map((departure) => ({
    ...departure,
    cancellation: cancellationOf(skips.get(`${departure.rideId}:${departure.serviceDate}`))
  }));
  const ridesById = new Map(rides.map((ride) => [ride.id, ride]));
  const extras: PlannedDeparture[] = [];

  // The filter the materializer applies: an ADDITIONAL without both times
  // produces no instance. A SKIP never removes an extra bus.
  for (const exception of inWindow) {
    const ride = ridesById.get(exception.rideId);

    if (
      !ride ||
      !rideRuns(ride) ||
      exception.type !== RideExceptionType.ADDITIONAL ||
      !exception.departureTime ||
      !exception.arrivalTime
    ) {
      continue;
    }

    extras.push({
      ...planExtra(ride, {
        keyId: exception.id,
        serviceDate: exception.exceptionDate,
        departureTime: exception.departureTime,
        arrivalTime: exception.arrivalTime,
        capacity: ride.capacity,
        rideExceptionId: exception.id
      }).departure,
      cancellation: null
    });
  }

  return [...scheduled, ...extras];
}

export async function loadHistoryExceptions(
  db: Db,
  tenantId: string,
  window: { from: string; to: string }
): Promise<HistoryException[]> {
  const exceptions = await db.rideException.findMany({
    where: {
      tenantId,
      exceptionDate: { gte: utcDateOf(window.from), lte: utcDateOf(window.to) }
    },
    select: {
      id: true,
      rideId: true,
      exceptionDate: true,
      type: true,
      departureTime: true,
      arrivalTime: true,
      createdAt: true,
      createdById: true,
      updatedById: true
    },
    // A deterministic SKIP when a date carries more than one.
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
  });

  return exceptions.map((exception) => ({
    ...exception,
    exceptionDate: formatDateOnly(exception.exceptionDate)!
  }));
}

function linkKey(rideId: string, date: string, departureTime: string): string {
  return `${rideId}:${date}:${departureTime}`;
}

/** The key `generateHistory`'s output for a stored row carries: an extra by its exception. */
function plannedKeyOf(departure: BackfillStoredDeparture): string | null {
  if (departure.source === DepartureSource.SCHEDULE) {
    return scheduleKey(departure.rideId, departure.serviceDate);
  }

  if (departure.source === DepartureSource.EXTRA && departure.rideExceptionId) {
    return extraKey(departure.rideExceptionId);
  }

  return null;
}

function byTravel(left: BackfillReservation, right: BackfillReservation): number {
  return (
    left.travelDate.localeCompare(right.travelDate) ||
    left.rideDepartureTime.localeCompare(right.rideDepartureTime) ||
    left.id.localeCompare(right.id)
  );
}

function byCreation(left: BackfillReservation, right: BackfillReservation): number {
  return left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id);
}

export function computeDepartureBackfill(input: BackfillInput): DepartureBackfillPlan {
  const newId = input.newId ?? randomUUID;
  const reservations = [...input.reservations].sort(byTravel);
  const wanted = new Set(
    reservations.map((row) => linkKey(row.rideId, row.travelDate, row.rideDepartureTime))
  );
  const storedPlannedKeys = new Set(
    input.stored.map(plannedKeyOf).filter((key): key is string => key !== null)
  );

  const historyCreates = input.history
    .filter(
      (departure) =>
        departure.serviceDate < input.agencyDate &&
        !storedPlannedKeys.has(departure.key) &&
        wanted.has(linkKey(departure.rideId, departure.serviceDate, departure.departureTime))
    )
    .map((departure) => ({ id: newId(), departure }));
  const historyIds = new Set(historyCreates.map(({ id }) => id));

  const candidates = new Map<string, string[]>();
  const addCandidate = (key: string, id: string) =>
    candidates.set(key, [...(candidates.get(key) ?? []), id]);
  const legacyByKey = new Map<string, BackfillStoredDeparture>();

  for (const departure of input.stored) {
    const key = linkKey(departure.rideId, departure.serviceDate, departure.departureTime);

    if (LINKABLE_SOURCES.includes(departure.source)) {
      addCandidate(key, departure.id);
    } else if (departure.source === DepartureSource.LEGACY) {
      legacyByKey.set(key, departure);
    }
  }

  for (const { id, departure } of historyCreates) {
    addCandidate(linkKey(departure.rideId, departure.serviceDate, departure.departureTime), id);
  }

  const reservationsById = new Map(reservations.map((row) => [row.id, row]));
  const linkedByReservation = new Map(
    (input.linked ?? []).map((row) => [row.reservationId, row.departureId])
  );
  const manualByReservation = new Map<string, string>();
  const manualDone = new Set<string>();
  const invalidManualLinks: InvalidManualLink[] = [];

  for (const link of input.manualLinks ?? []) {
    const reservation = reservationsById.get(link.reservationId);
    const linked = linkedByReservation.get(link.reservationId);
    const repeated =
      manualByReservation.has(link.reservationId) || manualDone.has(link.reservationId);

    if (!reservation && !repeated && linked === link.departureId) {
      manualDone.add(link.reservationId);
      continue;
    }

    const problem = repeated
      ? 'the reservation is listed more than once'
      : !reservation
        ? linked
          ? 'the reservation is already linked to another departure'
          : 'the reservation is not in this tenant'
        : !(
              candidates.get(
                linkKey(reservation.rideId, reservation.travelDate, reservation.rideDepartureTime)
              ) ?? []
            ).includes(link.departureId)
          ? 'the departure does not have the reservation’s ride, date and departure time'
          : null;

    if (problem) {
      invalidManualLinks.push({ ...link, problem });
    } else {
      manualByReservation.set(link.reservationId, link.departureId);
    }
  }

  const links: PlannedLink[] = [];
  const reported: ReportedReservation[] = [];
  const legacyGroups = new Map<string, BackfillReservation[]>();

  for (const reservation of reservations) {
    const key = linkKey(reservation.rideId, reservation.travelDate, reservation.rideDepartureTime);
    const ids = candidates.get(key) ?? [];
    const manual = manualByReservation.get(reservation.id);

    if (manual) {
      links.push({ reservationId: reservation.id, departureId: manual, via: 'MANUAL' });
      continue;
    }

    if (ids.length === 1) {
      links.push({
        reservationId: reservation.id,
        departureId: ids[0],
        via: historyIds.has(ids[0]) ? 'HISTORY' : 'EXISTING'
      });
      continue;
    }

    const past = reservation.travelDate < input.agencyDate;

    if (ids.length === 0 && (past || reservation.status === ReservationStatus.CANCELLED)) {
      legacyGroups.set(key, [...(legacyGroups.get(key) ?? []), reservation]);
      continue;
    }

    reported.push({
      reservationId: reservation.id,
      reason: ids.length === 0 ? 'NO_DEPARTURE' : 'SEVERAL_DEPARTURES',
      futureActive: !past && reservation.status === ReservationStatus.ACTIVE,
      rideId: reservation.rideId,
      travelDate: reservation.travelDate,
      rideDepartureTime: reservation.rideDepartureTime,
      status: reservation.status,
      candidateIds: ids
    });
  }

  const ridesById = new Map(input.rides.map((ride) => [ride.id, ride]));
  const legacyCreates: PlannedLegacyDeparture[] = [];
  const legacyReused: ReusedLegacyDeparture[] = [];
  const seatsByLegacy = new Map<string, number[]>();

  for (const { departureId, seatNumber } of input.legacySeats ?? []) {
    seatsByLegacy.set(departureId, [...(seatsByLegacy.get(departureId) ?? []), seatNumber]);
  }

  for (const [key, group] of legacyGroups) {
    const reservationIds = group.map((row) => row.id);
    const existing = legacyByKey.get(key);
    let departureId: string;

    if (existing) {
      departureId = existing.id;
      const seats = group.map((row) => row.seatNumber);
      legacyReused.push({
        id: existing.id,
        reservationIds,
        seatsAboveCapacity: [...new Set(seats.filter((seat) => seat > existing.capacity))].sort(
          (left, right) => left - right
        ),
        duplicateSeats: duplicateActiveSeats(group, seatsByLegacy.get(existing.id) ?? [])
      });
    } else {
      const [first] = group;
      const ride = ridesById.get(first.rideId);

      if (!ride) {
        throw new Error(`Ride ${first.rideId} of reservation ${first.id} was not loaded`);
      }

      const arrival = legacyArrival(group);
      const legacy: PlannedLegacyDeparture = {
        id: newId(),
        rideId: first.rideId,
        serviceDate: first.travelDate,
        departureTime: first.rideDepartureTime,
        arrivalTime: arrival.chosen,
        lineId: ride.lineId,
        capacity: Math.max(ride.capacity, ...group.map((row) => row.seatNumber)),
        reservationIds,
        arrivalTimesDisagree: arrival.all.length > 1 ? arrival.all : [],
        duplicateSeats: duplicateActiveSeats(group)
      };

      legacyCreates.push(legacy);
      departureId = legacy.id;
    }

    for (const reservationId of reservationIds) {
      links.push({ reservationId, departureId, via: 'LEGACY' });
    }
  }

  return {
    agencyDate: input.agencyDate,
    historyCreates,
    legacyCreates,
    legacyReused,
    links,
    reported,
    manualLinksDone: manualDone.size,
    invalidManualLinks
  };
}

/**
 * The arrival time most of the key's reservations were sold with. On a tie,
 * the one on the earliest-sold reservation: ordering the times themselves
 * would be wrong for a bus arriving after midnight.
 */
export function legacyArrival(group: readonly BackfillReservation[]): {
  chosen: string;
  all: string[];
} {
  const counts = new Map<string, number>();

  for (const row of [...group].sort(byCreation)) {
    counts.set(row.rideArrivalTime, (counts.get(row.rideArrivalTime) ?? 0) + 1);
  }

  let chosen = '';
  let best = 0;

  // A Map iterates in insertion order, which is the order of sale.
  for (const [time, count] of counts) {
    if (count > best) {
      chosen = time;
      best = count;
    }
  }

  return { chosen, all: [...counts.keys()] };
}

/** Seats sold twice among `group`'s active rows and the seats already taken. */
function duplicateActiveSeats(
  group: readonly BackfillReservation[],
  taken: readonly number[] = []
): number[] {
  const duplicates = new Set<number>();
  const seen = new Set<number>();

  for (const seat of taken) {
    if (seen.has(seat)) {
      duplicates.add(seat);
    }
    seen.add(seat);
  }

  for (const row of group) {
    if (row.status !== ReservationStatus.ACTIVE) {
      continue;
    }

    if (seen.has(row.seatNumber)) {
      duplicates.add(row.seatNumber);
    }
    seen.add(row.seatNumber);
  }

  return [...duplicates].sort((left, right) => left - right);
}

export function countDepartureBackfill(plan: DepartureBackfillPlan): DepartureBackfillCounts {
  const linked: Record<LinkVia, number> = { EXISTING: 0, HISTORY: 0, LEGACY: 0, MANUAL: 0 };
  const reported: DepartureBackfillCounts['reported'] = {
    NO_DEPARTURE: { futureActive: 0, other: 0 },
    SEVERAL_DEPARTURES: { futureActive: 0, other: 0 }
  };

  for (const link of plan.links) {
    linked[link.via] += 1;
  }

  for (const row of plan.reported) {
    reported[row.reason][row.futureActive ? 'futureActive' : 'other'] += 1;
  }

  return {
    historyCreated: plan.historyCreates.length,
    legacyCreated: plan.legacyCreates.length,
    legacyCreatedFuture: plan.legacyCreates.filter(
      (legacy) => legacy.serviceDate >= plan.agencyDate
    ).length,
    legacyReused: plan.legacyReused.length,
    linked,
    reported,
    legacyArrivalDisagreements: plan.legacyCreates.filter(
      (legacy) => legacy.arrivalTimesDisagree.length > 0
    ).length,
    legacyDuplicateSeats: [...plan.legacyCreates, ...plan.legacyReused].filter(
      (legacy) => legacy.duplicateSeats.length > 0
    ).length,
    legacyReusedOverCapacity: plan.legacyReused.filter(
      (legacy) => legacy.seatsAboveCapacity.length > 0
    ).length,
    manualLinksDone: plan.manualLinksDone,
    invalidManualLinks: plan.invalidManualLinks.length
  };
}

/** Whether the plan writes anything. A second run after an apply must not. */
export function backfillWrites(plan: DepartureBackfillPlan): boolean {
  return plan.historyCreates.length > 0 || plan.legacyCreates.length > 0 || plan.links.length > 0;
}

/**
 * The plan for one tenant, from what is stored. Handed a root client (the dry
 * run), every read shares one snapshot; handed a transaction (the apply, under
 * the schedule lock), it reads inside it.
 */
export async function planDepartureBackfill(
  db: Db,
  tenantId: string,
  { now = new Date(), manualLinks = [] }: { now?: Date; manualLinks?: readonly ManualLink[] } = {}
): Promise<DepartureBackfillPlan> {
  if ('$transaction' in db) {
    return db.$transaction((tx) => planDepartureBackfill(tx, tenantId, { now, manualLinks }), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      maxWait: 5_000,
      timeout: 60_000
    });
  }

  const tenant = await db.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { timezone: true }
  });
  const today = agencyDate(now, resolveAgencyTimezone(tenant.timezone).timezone);
  const rows = await db.reservation.findMany({
    where: { tenantId, departureId: null },
    select: {
      id: true,
      rideId: true,
      travelDate: true,
      rideDepartureTime: true,
      rideArrivalTime: true,
      seatNumber: true,
      status: true,
      createdAt: true
    }
  });
  const reservations = rows.map((row) => ({
    ...row,
    travelDate: formatDateOnly(row.travelDate)!
  }));

  const linked =
    manualLinks.length === 0
      ? []
      : await db.reservation.findMany({
          where: {
            tenantId,
            id: { in: manualLinks.map((link) => link.reservationId) },
            departureId: { not: null }
          },
          select: { id: true, departureId: true }
        });
  const linkedInput = linked.map((row) => ({
    reservationId: row.id,
    departureId: row.departureId!
  }));

  if (reservations.length === 0) {
    return computeDepartureBackfill({
      agencyDate: today,
      reservations: [],
      stored: [],
      history: [],
      rides: [],
      manualLinks,
      linked: linkedInput
    });
  }

  const dates = reservations.map((row) => row.travelDate).sort();
  const from = dates[0];
  const to = dates[dates.length - 1];
  const yesterday = addDays(today, -1);
  const historyTo = to < yesterday ? to : yesterday;

  const dateRange = { gte: utcDateOf(from), lte: utcDateOf(to) };
  const [stored, rides, legacySeats] = await Promise.all([
    db.departure.findMany({
      where: { tenantId, serviceDate: dateRange },
      select: {
        id: true,
        source: true,
        rideId: true,
        serviceDate: true,
        departureTime: true,
        rideExceptionId: true,
        capacity: true
      }
    }),
    loadRides(db, tenantId),
    db.reservation.findMany({
      where: {
        tenantId,
        travelDate: dateRange,
        status: ReservationStatus.ACTIVE,
        departure: { source: DepartureSource.LEGACY }
      },
      select: { departureId: true, seatNumber: true }
    })
  ]);
  const history =
    from <= historyTo
      ? generateHistory(
          rides,
          await loadHistoryExceptions(db, tenantId, { from, to: historyTo }),
          from,
          historyTo
        )
      : [];

  return computeDepartureBackfill({
    agencyDate: today,
    reservations,
    stored: stored.map((departure) => ({
      ...departure,
      serviceDate: formatDateOnly(departure.serviceDate)!
    })),
    history,
    rides,
    legacySeats: legacySeats.map((row) => ({
      departureId: row.departureId!,
      seatNumber: row.seatNumber
    })),
    manualLinks,
    linked: linkedInput
  });
}

/** Why an apply wrote nothing for a tenant. */
export class BackfillRefused extends Error {}

/**
 * The stored future window is what reservations are matched against, so it
 * has to be what the timetable says.
 */
export async function assertReadyForBackfill(
  tx: Prisma.TransactionClient,
  tenantId: string,
  now: Date = new Date()
): Promise<void> {
  const sync = await planDepartureSync(tx, tenantId, now);
  const drift = sync.creates.length + sync.updates.length + sync.drops.length + sync.deletes.length;

  if (drift > 0) {
    throw new BackfillRefused(
      `stored departures are out of step with the timetable (${sync.creates.length} missing, ` +
        `${sync.updates.length} to update, ${sync.drops.length} to drop, ${sync.deletes.length} ` +
        'to delete). See departure.matchesTimetable, and run departures:sync first.'
    );
  }
}

export async function applyDepartureBackfill(
  tx: Prisma.TransactionClient,
  plan: DepartureBackfillPlan,
  scope: DepartureSyncScope
): Promise<void> {
  if (plan.invalidManualLinks.length > 0) {
    throw new BackfillRefused(
      `${plan.invalidManualLinks.length} manual link(s) are invalid; nothing was written.`
    );
  }

  await insertPlannedDepartures(tx, plan.historyCreates, scope);

  if (plan.legacyCreates.length > 0) {
    await tx.departure.createMany({
      data: plan.legacyCreates.map((legacy) => ({
        id: legacy.id,
        tenantId: scope.tenantId,
        rideId: legacy.rideId,
        serviceDate: utcDateOf(legacy.serviceDate),
        source: DepartureSource.LEGACY,
        lineId: legacy.lineId,
        departureTime: legacy.departureTime,
        arrivalTime: legacy.arrivalTime,
        capacity: legacy.capacity,
        createdById: scope.actorId,
        updatedById: scope.actorId
      }))
    });
  }

  const byDeparture = new Map<string, string[]>();

  for (const link of plan.links) {
    byDeparture.set(link.departureId, [
      ...(byDeparture.get(link.departureId) ?? []),
      link.reservationId
    ]);
  }

  for (const [departureId, reservationIds] of byDeparture) {
    // `departureId: null` keeps an existing link from ever being rewritten.
    const { count } = await tx.reservation.updateMany({
      where: { tenantId: scope.tenantId, id: { in: reservationIds }, departureId: null },
      data: { departureId, updatedById: scope.actorId }
    });

    if (count !== reservationIds.length) {
      throw new Error(
        `Expected to link ${reservationIds.length} reservation(s) to ${departureId}, linked ${count}`
      );
    }
  }
}

/**
 * Plans and applies one tenant under its exclusive schedule lock, so no
 * booking lands between the plan and the write. Credited to the system actor.
 */
export function backfillDepartures(
  prisma: ScheduleLockRoot,
  tenantId: string,
  { now = new Date(), manualLinks = [] }: { now?: Date; manualLinks?: readonly ManualLink[] } = {}
): Promise<DepartureBackfillPlan> {
  const scope = { tenantId, actorId: SYSTEM_ACTOR_ID };

  return scheduleEditTransaction(
    prisma,
    scope,
    async (tx) => {
      await assertReadyForBackfill(tx, tenantId, now);
      const plan = await planDepartureBackfill(tx, tenantId, { now, manualLinks });
      await applyDepartureBackfill(tx, plan, scope);

      return plan;
    },
    // The backfill writes no timetable, and the check above has just shown
    // the stored window in step with it. The default timeout stays: bookings
    // give up on the lock after 10 s, and the largest tenant held it 1.6 s.
    { departureSync: false }
  );
}
