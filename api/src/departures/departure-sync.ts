import { ConflictException } from '@nestjs/common';
import { DepartureSource, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { formatDateOnly, utcDateOf } from '../rides/ride-instance-materialization';
import { DepartureWindow, departureWindow, resolveAgencyTimezone } from './agency-date';
import {
  GeneratorRide,
  PlannedDeparture,
  PlannedStop,
  generateDepartures,
  planExtra,
  scheduleKey
} from './departure-generator';

/**
 * Keeps a tenant's stored departures in step with its timetable.
 *
 * Planning and applying are separate so `departure.matchesTimetable` and the
 * `departures:sync` dry run can report exactly what a sync would write, from
 * the same code that writes it.
 *
 * Only future `SCHEDULE` and `EXTRA` departures inside the window are touched.
 * A past departure keeps what it ran with, and `LEGACY` rows belong to the
 * backfill.
 *
 * Operator decisions belong to the operator (#27, PR 3a). The sync never sets
 * or clears a cancellation, never creates an extra bus, and never deletes a
 * departure that carries a decision — an extra, or a cancelled departure. When
 * the timetable stops producing one it is marked dropped instead, and the mark
 * is cleared when the timetable produces it again, with the decision intact.
 */

type Db = PrismaService | Prisma.TransactionClient;

export interface DepartureSyncScope {
  tenantId: string;
  actorId: string;
}

/**
 * `full` runs inside every timetable write. `insertOnly` is the nightly job:
 * it adds the departures that are missing, typically the day that just entered
 * the window, and never changes or removes one.
 */
export type DepartureSyncMode = 'full' | 'insertOnly';

export type DepartureField =
  | 'lineId'
  | 'departureTime'
  | 'arrivalTime'
  | 'capacity'
  | 'timetableDroppedAt'
  | 'stops';

export interface StoredDeparture {
  id: string;
  source: DepartureSource;
  rideId: string;
  serviceDate: string;
  lineId: string;
  departureTime: string;
  arrivalTime: string;
  capacity: number;
  timetableDroppedAt: Date | null;
  cancelledAt: Date | null;
  cancelledById: string | null;
  rideExceptionId: string | null;
  stops: PlannedStop[];
  referenceCount: number;
}

export interface DepartureUpdate {
  stored: StoredDeparture;
  planned: PlannedDeparture;
  /**
   * Whether the departure should carry `timetableDroppedAt`. Only an extra
   * bus can be updated into the dropped state: it follows its ride.
   */
  dropped: boolean;
  fields: DepartureField[];
}

/**
 * A `SCHEDULE` departure the sync would write at the departure time of an
 * extra bus of the same ride and date. Until PR 4 a booking from the UI names
 * its bus by that time, so two buses sharing one would make both unbookable.
 */
export interface SameTimeConflict {
  planned: PlannedDeparture;
  extraId: string;
  /** From a create, which the nightly job also writes, rather than an update. */
  create: boolean;
}

export interface DepartureSyncPlan {
  window: DepartureWindow;
  /** The zone the window was read in. */
  timezone: string;
  /** The tenant's own setting, as stored. */
  configuredTimezone: string | null;
  timezoneInvalid: boolean;
  /** Every departure the timetable produces inside the window, and every stored extra. */
  plannedCount: number;
  creates: PlannedDeparture[];
  updates: DepartureUpdate[];
  /**
   * No longer produced, and referenced or cancelled: kept, with
   * `timetableDroppedAt` set.
   */
  drops: StoredDeparture[];
  /** No longer produced, never cancelled, and referenced by nothing. */
  deletes: StoredDeparture[];
  /** Pairs this sync would create; applying refuses while there are any. */
  conflicts: SameTimeConflict[];
}

export interface DepartureSyncCounts {
  created: number;
  updated: number;
  dropped: number;
  deleted: number;
}

export async function planDepartureSync(
  db: Db,
  tenantId: string,
  now: Date = new Date()
): Promise<DepartureSyncPlan> {
  // Handed a root client (the check, the dry run), the reads share one
  // snapshot. Otherwise each would run on its own connection, and an edit
  // committing between them would show up as drift that is not there.
  if ('$transaction' in db) {
    return db.$transaction((tx) => planDepartureSync(tx, tenantId, now), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      maxWait: 5_000,
      timeout: 30_000
    });
  }

  const tenant = await db.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { timezone: true }
  });
  const zone = resolveAgencyTimezone(tenant.timezone);
  const window = departureWindow(now, zone.timezone);
  const [rides, stored] = await Promise.all([
    loadRides(db, tenantId),
    loadStored(db, tenantId, window)
  ]);
  const planned = generateDepartures(rides, window.from, window.to);
  const changes = diffDepartures(planned, stored, rides);

  return {
    window,
    timezone: zone.timezone,
    configuredTimezone: zone.configured,
    timezoneInvalid: zone.invalid,
    plannedCount:
      planned.length +
      stored.filter((departure) => departure.source === DepartureSource.EXTRA).length,
    ...changes
  };
}

export async function applyDepartureSync(
  tx: Prisma.TransactionClient,
  plan: DepartureSyncPlan,
  scope: DepartureSyncScope,
  mode: DepartureSyncMode,
  now: Date = new Date()
): Promise<DepartureSyncCounts> {
  const conflicts = plan.conflicts.filter((conflict) => mode === 'full' || conflict.create);

  if (conflicts.length > 0) {
    throw sameTimeRefusal(conflicts[0].planned);
  }

  await createDepartures(tx, plan.creates, scope);

  if (mode === 'insertOnly') {
    return { created: plan.creates.length, updated: 0, dropped: 0, deleted: 0 };
  }

  await updateDepartures(tx, plan.updates, scope, now);

  if (plan.drops.length > 0) {
    await tx.departure.updateMany({
      where: { id: { in: plan.drops.map((stored) => stored.id) } },
      data: { timetableDroppedAt: now, updatedById: scope.actorId }
    });
  }

  if (plan.deletes.length > 0) {
    await tx.departure.deleteMany({
      where: { id: { in: plan.deletes.map((stored) => stored.id) } }
    });
  }

  return {
    created: plan.creates.length,
    updated: plan.updates.length,
    dropped: plan.drops.length,
    deleted: plan.deletes.length
  };
}

/**
 * Plans and applies in one go. The caller holds the tenant's exclusive
 * schedule lock, so the timetable it reads cannot change before it writes.
 */
export async function syncDepartures(
  tx: Prisma.TransactionClient,
  scope: DepartureSyncScope,
  mode: DepartureSyncMode = 'full',
  now: Date = new Date()
): Promise<DepartureSyncCounts> {
  const plan = await planDepartureSync(tx, scope.tenantId, now);

  return applyDepartureSync(tx, plan, scope, mode, now);
}

/**
 * The refusal for any write that would leave two departures of one ride on
 * one date at the same departure time.
 */
export function sameTimeRefusal(departure: {
  serviceDate: string;
  departureTime: string;
}): ConflictException {
  return new ConflictException({
    code: 'DEPARTURE_TIME_TAKEN',
    message: `Ova voznja ${departure.serviceDate} vec ima polazak u ${departure.departureTime}. Dva polaska iste voznje istog dana ne mogu da krecu u isto vreme.`
  });
}

/**
 * What the sync would write, from the timetable's departures, the stored
 * window and the rides. Pure, so the rules below are tested without a
 * database.
 *
 * - A `SCHEDULE` departure is matched by ride and date. Its line, times,
 *   capacity and stops follow the timetable, and a dropped one comes back.
 * - An `EXTRA` is never produced by the timetable. Its line and stops follow
 *   its ride, and it is dropped while the ride does not run; its times and
 *   capacity are the operator's.
 * - A departure the timetable no longer produces is deleted only when nothing
 *   references it and nobody cancelled it. Otherwise it is marked dropped.
 */
export function diffDepartures(
  planned: readonly PlannedDeparture[],
  stored: readonly StoredDeparture[],
  rides: readonly GeneratorRide[]
): Pick<DepartureSyncPlan, 'creates' | 'updates' | 'drops' | 'deletes' | 'conflicts'> {
  const ridesById = new Map(rides.map((ride) => [ride.id, ride]));
  const storedByKey = new Map<string, StoredDeparture>();
  const extras: StoredDeparture[] = [];
  const unmatched: StoredDeparture[] = [];

  for (const departure of stored) {
    if (departure.source === DepartureSource.EXTRA) {
      extras.push(departure);
      continue;
    }

    const key = scheduleKey(departure.rideId, departure.serviceDate);

    if (!storedByKey.has(key)) {
      storedByKey.set(key, departure);
    } else {
      unmatched.push(departure);
    }
  }

  const creates: PlannedDeparture[] = [];
  const updates: DepartureUpdate[] = [];

  for (const departure of planned) {
    const match = storedByKey.get(departure.key);

    if (!match) {
      creates.push(departure);
      continue;
    }

    storedByKey.delete(departure.key);

    const fields = changedFields(match, departure, false);

    if (fields.length > 0) {
      updates.push({ stored: match, planned: departure, dropped: false, fields });
    }
  }

  for (const extra of extras) {
    const ride = ridesById.get(extra.rideId);

    // A ride is never deleted while a departure references it, so this is a
    // row the sync cannot shape; it is left as it is.
    if (!ride) {
      continue;
    }

    const { departure, dropped: rideDropped } = planExtra(ride, {
      keyId: extra.id,
      serviceDate: extra.serviceDate,
      departureTime: extra.departureTime,
      arrivalTime: extra.arrivalTime,
      capacity: extra.capacity,
      rideExceptionId: extra.rideExceptionId
    });
    // Before PR 3a, deleting a booked ADDITIONAL left its extra dropped rather
    // than cancelled. Nobody has decided anything about such an orphan since,
    // so it is not brought back; `departure.matchesExceptions` lists it.
    const orphan = extra.rideExceptionId === null && extra.cancelledAt === null;
    const dropped = rideDropped || (orphan && extra.timetableDroppedAt !== null);
    const fields = changedFields(extra, departure, dropped);

    if (fields.length > 0) {
      updates.push({ stored: extra, planned: departure, dropped, fields });
    }
  }

  const gone = [...unmatched, ...storedByKey.values()];
  const kept = (departure: StoredDeparture) =>
    departure.referenceCount > 0 || departure.cancelledAt !== null;

  return {
    creates,
    updates,
    // A kept departure already marked dropped needs nothing more.
    drops: gone.filter((departure) => kept(departure) && !departure.timetableDroppedAt),
    deletes: gone.filter((departure) => !kept(departure)),
    conflicts: sameTimeConflicts(creates, updates, extras)
  };
}

function sameTimeConflicts(
  creates: readonly PlannedDeparture[],
  updates: readonly DepartureUpdate[],
  extras: readonly StoredDeparture[]
): SameTimeConflict[] {
  if (extras.length === 0) {
    return [];
  }

  const extraAt = new Map(
    extras.map((extra) => [`${extra.rideId}:${extra.serviceDate}:${extra.departureTime}`, extra.id])
  );
  const conflictOf = (planned: PlannedDeparture, create: boolean): SameTimeConflict[] => {
    const extraId = extraAt.get(
      `${planned.rideId}:${planned.serviceDate}:${planned.departureTime}`
    );

    return extraId ? [{ planned, extraId, create }] : [];
  };

  // Only what this sync writes: a pair already stored is counted by the
  // rehearsal and left for PR 4, not allowed to block every edit meanwhile.
  return [
    ...creates.flatMap((planned) => conflictOf(planned, true)),
    ...updates
      .filter(
        ({ stored, fields }) =>
          stored.source === DepartureSource.SCHEDULE && fields.includes('departureTime')
      )
      .flatMap(({ planned }) => conflictOf(planned, false))
  ];
}

function changedFields(
  stored: StoredDeparture,
  planned: PlannedDeparture,
  dropped: boolean
): DepartureField[] {
  const fields: DepartureField[] = [];

  if (stored.lineId !== planned.lineId) fields.push('lineId');
  if (stored.departureTime !== planned.departureTime) fields.push('departureTime');
  if (stored.arrivalTime !== planned.arrivalTime) fields.push('arrivalTime');
  if (stored.capacity !== planned.capacity) fields.push('capacity');
  if ((stored.timetableDroppedAt !== null) !== dropped) fields.push('timetableDroppedAt');
  if (!sameStops(stored.stops, planned.stops)) fields.push('stops');

  return fields;
}

function sameStops(left: readonly PlannedStop[], right: readonly PlannedStop[]): boolean {
  return JSON.stringify(sortedStops(left)) === JSON.stringify(sortedStops(right));
}

function sortedStops(stops: readonly PlannedStop[]): PlannedStop[] {
  return [...stops]
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map(({ stationId, orderIndex, time, isBoarding, isDropoff }) => ({
      stationId,
      orderIndex,
      time,
      isBoarding,
      isDropoff
    }));
}

async function createDepartures(
  tx: Prisma.TransactionClient,
  creates: readonly PlannedDeparture[],
  scope: DepartureSyncScope
): Promise<void> {
  if (creates.length === 0) {
    return;
  }

  await insertPlannedDepartures(
    tx,
    creates.map((departure) => ({ id: randomUUID(), departure })),
    scope
  );
}

/**
 * Writes planned departures, with their stops, under IDs the caller chose. The
 * sync and `departures:backfill` both write through here, so a past departure
 * the backfill adds is written the way the sync writes one.
 */
export async function insertPlannedDepartures(
  tx: Prisma.TransactionClient,
  rows: ReadonlyArray<{ id: string; departure: PlannedDeparture; droppedAt?: Date | null }>,
  scope: DepartureSyncScope
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  // Plain inserts, not ON CONFLICT: the caller holds the exclusive schedule
  // lock and planned against what is stored, so a conflict is a bug and must
  // fail loudly rather than be skipped.
  await tx.departure.createMany({
    data: rows.map(({ id, departure, droppedAt }) => ({
      id,
      tenantId: scope.tenantId,
      rideId: departure.rideId,
      serviceDate: utcDateOf(departure.serviceDate),
      source: departure.source,
      lineId: departure.lineId,
      departureTime: departure.departureTime,
      arrivalTime: departure.arrivalTime,
      capacity: departure.capacity,
      timetableDroppedAt: droppedAt ?? null,
      cancelledAt: departure.cancellation?.at ?? null,
      cancelledById: departure.cancellation?.by ?? null,
      rideExceptionId: departure.rideExceptionId,
      createdById: scope.actorId,
      updatedById: scope.actorId
    }))
  });
  await tx.departureStop.createMany({
    data: rows.flatMap(({ id, departure }) => stopRows(id, departure.stops, scope))
  });
}

/**
 * Writes every update in a handful of statements, because it runs while every
 * booking of the tenant waits on the schedule lock. Departures that end up
 * with the same values share one `updateMany`: a capacity change on a daily
 * ride is one statement per distinct weekday timing, not one per date. Stops
 * are replaced in one delete and one insert across every departure whose stops
 * changed, and a departure whose only change is its stops keeps its row as is.
 */
async function updateDepartures(
  tx: Prisma.TransactionClient,
  updates: readonly DepartureUpdate[],
  scope: DepartureSyncScope,
  now: Date
): Promise<void> {
  const groups = new Map<
    string,
    { data: Prisma.DepartureUncheckedUpdateManyInput; ids: string[] }
  >();

  for (const { stored, planned, dropped, fields } of updates) {
    if (fields.every((field) => field === 'stops')) {
      continue;
    }

    // Never the cancellation: that is the operator's.
    const data: Prisma.DepartureUncheckedUpdateManyInput = {
      lineId: planned.lineId,
      departureTime: planned.departureTime,
      arrivalTime: planned.arrivalTime,
      capacity: planned.capacity,
      timetableDroppedAt: dropped ? (stored.timetableDroppedAt ?? now) : null,
      updatedById: scope.actorId
    };
    const key = JSON.stringify(data);
    const group = groups.get(key) ?? { data, ids: [] as string[] };

    group.ids.push(stored.id);
    groups.set(key, group);
  }

  for (const { data, ids } of groups.values()) {
    await tx.departure.updateMany({ where: { id: { in: ids } }, data });
  }

  const restopped = updates.filter(({ fields }) => fields.includes('stops'));

  if (restopped.length === 0) {
    return;
  }

  await tx.departureStop.deleteMany({
    where: { departureId: { in: restopped.map(({ stored }) => stored.id) } }
  });
  await tx.departureStop.createMany({
    data: restopped.flatMap(({ stored, planned }) => stopRows(stored.id, planned.stops, scope))
  });
}

function stopRows(departureId: string, stops: readonly PlannedStop[], scope: DepartureSyncScope) {
  return stops.map((stop) => ({
    id: randomUUID(),
    tenantId: scope.tenantId,
    departureId,
    stationId: stop.stationId,
    orderIndex: stop.orderIndex,
    time: stop.time,
    isBoarding: stop.isBoarding,
    isDropoff: stop.isDropoff,
    createdById: scope.actorId,
    updatedById: scope.actorId
  }));
}

export async function loadRides(
  db: Db,
  tenantId: string,
  rideId?: string
): Promise<GeneratorRide[]> {
  return db.ride.findMany({
    where: { tenantId, ...(rideId ? { id: rideId } : {}) },
    select: {
      id: true,
      lineId: true,
      capacity: true,
      status: true,
      type: true,
      recurringStartDate: true,
      recurringEndDate: true,
      oneTimeDate: true,
      oneTimeDepartureTime: true,
      oneTimeArrivalTime: true,
      line: {
        select: {
          isActive: true,
          departureStationId: true,
          arrivalStationId: true,
          intermediateStops: {
            select: { stationId: true, orderIndex: true, isBoarding: true, isDropoff: true },
            orderBy: { orderIndex: 'asc' }
          }
        }
      },
      daySchedules: {
        select: {
          dayOfWeek: true,
          stationTimes: { select: { stationId: true, orderIndex: true, time: true } }
        }
      }
    }
  });
}

async function loadStored(
  db: Db,
  tenantId: string,
  window: DepartureWindow
): Promise<StoredDeparture[]> {
  const departures = await db.departure.findMany({
    where: {
      tenantId,
      source: { in: [DepartureSource.SCHEDULE, DepartureSource.EXTRA] },
      serviceDate: { gte: utcDateOf(window.from), lte: utcDateOf(window.to) }
    },
    select: {
      id: true,
      source: true,
      rideId: true,
      serviceDate: true,
      lineId: true,
      departureTime: true,
      arrivalTime: true,
      capacity: true,
      timetableDroppedAt: true,
      cancelledAt: true,
      cancelledById: true,
      rideExceptionId: true,
      stops: {
        select: {
          stationId: true,
          orderIndex: true,
          time: true,
          isBoarding: true,
          isDropoff: true
        }
      },
      _count: { select: { reservations: true } }
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
  });

  return departures.map(({ _count, serviceDate, ...departure }) => ({
    ...departure,
    serviceDate: formatDateOnly(serviceDate)!,
    referenceCount: _count.reservations
  }));
}
