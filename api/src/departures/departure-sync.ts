import { DepartureSource, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { formatDateOnly, utcDateOf } from '../rides/ride-instance-materialization';
import { DepartureWindow, departureWindow, resolveAgencyTimezone } from './agency-date';
import {
  GeneratorException,
  GeneratorRide,
  PlannedDeparture,
  PlannedStop,
  extraKey,
  generateDepartures,
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
  | 'cancellation'
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
  fields: DepartureField[];
}

export interface DepartureSyncPlan {
  window: DepartureWindow;
  /** The zone the window was read in. */
  timezone: string;
  /** The tenant's own setting, as stored. */
  configuredTimezone: string | null;
  timezoneInvalid: boolean;
  /** Every departure the timetable produces inside the window. */
  plannedCount: number;
  creates: PlannedDeparture[];
  updates: DepartureUpdate[];
  /** No longer produced and referenced: kept, with `timetableDroppedAt` set. */
  drops: StoredDeparture[];
  /** No longer produced and referenced by nothing. */
  deletes: StoredDeparture[];
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
  const [rides, exceptions, stored] = await Promise.all([
    loadRides(db, tenantId),
    loadExceptions(db, tenantId, window),
    loadStored(db, tenantId, window)
  ]);
  const planned = generateDepartures(rides, exceptions, window.from, window.to);

  return {
    window,
    timezone: zone.timezone,
    configuredTimezone: zone.configured,
    timezoneInvalid: zone.invalid,
    plannedCount: planned.length,
    ...diff(planned, stored)
  };
}

export async function applyDepartureSync(
  tx: Prisma.TransactionClient,
  plan: DepartureSyncPlan,
  scope: DepartureSyncScope,
  mode: DepartureSyncMode,
  now: Date = new Date()
): Promise<DepartureSyncCounts> {
  await createDepartures(tx, plan.creates, scope);

  if (mode === 'insertOnly') {
    return { created: plan.creates.length, updated: 0, dropped: 0, deleted: 0 };
  }

  await updateDepartures(tx, plan.updates, scope);

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

function diff(
  planned: readonly PlannedDeparture[],
  stored: readonly StoredDeparture[]
): Pick<DepartureSyncPlan, 'creates' | 'updates' | 'drops' | 'deletes'> {
  const storedByKey = new Map<string, StoredDeparture>();
  const unmatched: StoredDeparture[] = [];

  for (const departure of stored) {
    const key = storedKey(departure);

    if (key && !storedByKey.has(key)) {
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

    // An extra is matched by its exception. A row on another ride or date is
    // not the same departure, and the reservation key refuses the move.
    if (match.rideId !== departure.rideId || match.serviceDate !== departure.serviceDate) {
      unmatched.push(match);
      creates.push(departure);
      continue;
    }

    const fields = changedFields(match, departure);

    if (fields.length > 0) {
      updates.push({ stored: match, planned: departure, fields });
    }
  }

  const gone = [...unmatched, ...storedByKey.values()];

  return {
    creates,
    updates,
    // A referenced departure already marked dropped needs nothing more.
    drops: gone.filter(
      (departure) => departure.referenceCount > 0 && !departure.timetableDroppedAt
    ),
    deletes: gone.filter((departure) => departure.referenceCount === 0)
  };
}

/**
 * The key a stored row answers to. An extra whose exception is gone, or no
 * longer on the row's ride and date, answers to nothing: it is left over.
 */
function storedKey(departure: StoredDeparture): string | null {
  if (departure.source === DepartureSource.SCHEDULE) {
    return scheduleKey(departure.rideId, departure.serviceDate);
  }

  return departure.rideExceptionId ? extraKey(departure.rideExceptionId) : null;
}

function changedFields(stored: StoredDeparture, planned: PlannedDeparture): DepartureField[] {
  const fields: DepartureField[] = [];

  if (stored.lineId !== planned.lineId) fields.push('lineId');
  if (stored.departureTime !== planned.departureTime) fields.push('departureTime');
  if (stored.arrivalTime !== planned.arrivalTime) fields.push('arrivalTime');
  if (stored.capacity !== planned.capacity) fields.push('capacity');
  if (stored.timetableDroppedAt) fields.push('timetableDroppedAt');
  if (!sameCancellation(stored, planned)) fields.push('cancellation');
  if (!sameStops(stored.stops, planned.stops)) fields.push('stops');

  return fields;
}

function sameCancellation(stored: StoredDeparture, planned: PlannedDeparture): boolean {
  if (!planned.cancellation) {
    return stored.cancelledAt === null;
  }

  return (
    stored.cancelledAt?.getTime() === planned.cancellation.at.getTime() &&
    stored.cancelledById === planned.cancellation.by
  );
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

  const rows = creates.map((departure) => ({ id: randomUUID(), departure }));

  // Plain inserts, not ON CONFLICT: the caller holds the exclusive schedule
  // lock and planned against what is stored, so a conflict is a bug and must
  // fail loudly rather than be skipped.
  await tx.departure.createMany({
    data: rows.map(({ id, departure }) => ({
      id,
      tenantId: scope.tenantId,
      rideId: departure.rideId,
      serviceDate: utcDateOf(departure.serviceDate),
      source: departure.source,
      lineId: departure.lineId,
      departureTime: departure.departureTime,
      arrivalTime: departure.arrivalTime,
      capacity: departure.capacity,
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
  scope: DepartureSyncScope
): Promise<void> {
  const groups = new Map<
    string,
    { data: Prisma.DepartureUncheckedUpdateManyInput; ids: string[] }
  >();

  for (const { stored, planned, fields } of updates) {
    if (fields.every((field) => field === 'stops')) {
      continue;
    }

    const data: Prisma.DepartureUncheckedUpdateManyInput = {
      lineId: planned.lineId,
      departureTime: planned.departureTime,
      arrivalTime: planned.arrivalTime,
      capacity: planned.capacity,
      timetableDroppedAt: null,
      cancelledAt: planned.cancellation?.at ?? null,
      cancelledById: planned.cancellation?.by ?? null,
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

async function loadRides(db: Db, tenantId: string): Promise<GeneratorRide[]> {
  return db.ride.findMany({
    where: { tenantId },
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
          intermediateStops: { select: { stationId: true, isBoarding: true, isDropoff: true } }
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

async function loadExceptions(
  db: Db,
  tenantId: string,
  window: DepartureWindow
): Promise<GeneratorException[]> {
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
