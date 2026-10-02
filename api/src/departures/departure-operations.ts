import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DepartureSource, Prisma, RideExceptionType, RideStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { withCreateAudit, withUpdateAudit } from '../prisma/audit-write.helper';
import { formatDateOnly, utcDateOf } from '../rides/ride-instance-materialization';
import { DepartureWindow, departureWindow, resolveAgencyTimezone } from './agency-date';
import { GeneratorRide, generateDepartures, planExtra } from './departure-generator';
import { LINKABLE_SOURCES } from './departure-link';
import {
  departureUpdate,
  insertPlannedDepartures,
  loadRides,
  loadStoredDeparture,
  sameTimeRefusal,
  updateDepartures
} from './departure-sync';

/**
 * Operator decisions on departures (#27, PRs 3a and 3d): cancelling and
 * restoring a departure, and adding, editing and deleting an extra bus.
 *
 * A decision is written on the departure, because the sync no longer reads
 * `RideException`. Until PR 6 every decision also keeps its exception row,
 * which `/rides/instances` and the ride screen still read, and
 * `departure.matchesExceptions` checks that the two agree:
 * - a cancelled timetable departure has a SKIP on its ride and date;
 * - a running extra has its ADDITIONAL, with the same times;
 * - a cancelled extra has none.
 *
 * The departure endpoints, the exception endpoints and the fixtures all write
 * through here, so none of them can record one half without the other, and a
 * rollback to code that reads only the exception rows loses nothing.
 *
 * Every function expects the caller to hold the tenant's exclusive schedule
 * lock (`scheduleEditTransaction`).
 */

type Tx = Prisma.TransactionClient;

export interface DecisionScope {
  tenantId: string;
  rideId: string;
  actorId: string;
}

/** The dates a decision can be made for: the agency's today to the horizon. */
export async function decisionWindow(
  tx: Tx,
  tenantId: string,
  now: Date = new Date()
): Promise<DepartureWindow> {
  const tenant = await tx.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { timezone: true }
  });

  return departureWindow(now, resolveAgencyTimezone(tenant.timezone).timezone);
}

/**
 * Refuses a date outside the stored window: a past date is the record of what
 * ran, and nothing is stored or booked past the horizon.
 */
export async function assertDecisionDate(
  tx: Tx,
  tenantId: string,
  date: Date,
  now: Date = new Date()
): Promise<void> {
  const window = await decisionWindow(tx, tenantId, now);
  const day = formatDateOnly(date)!;

  if (day < window.from || day > window.to) {
    throw new BadRequestException(
      `Datum ${day} je van dozvoljenog opsega. Polasci i izuzeci se mogu menjati samo od ${window.from} do ${window.to}.`
    );
  }
}

const EXCEPTION_SELECT = {
  id: true,
  exceptionDate: true,
  type: true,
  departureTime: true,
  arrivalTime: true,
  createdById: true,
  updatedById: true,
  createdAt: true,
  updatedAt: true
} as const satisfies Prisma.RideExceptionSelect;

export type ExceptionRow = Prisma.RideExceptionGetPayload<{ select: typeof EXCEPTION_SELECT }>;

/** What an operation needs to know about the departure it acts on. */
export const OPERATED_DEPARTURE_SELECT = {
  id: true,
  tenantId: true,
  rideId: true,
  serviceDate: true,
  source: true,
  departureTime: true,
  arrivalTime: true,
  capacity: true,
  cancelledAt: true,
  rideExceptionId: true,
  _count: { select: { reservations: true } }
} as const satisfies Prisma.DepartureSelect;

export type OperatedDeparture = Prisma.DepartureGetPayload<{
  select: typeof OPERATED_DEPARTURE_SELECT;
}>;

/**
 * The departure an operation acts on, read under the schedule lock. Another
 * tenant's departure answers 404, the same as an unknown ID.
 */
export async function loadOperatedDeparture(
  tx: Tx,
  tenantId: string,
  id: string
): Promise<OperatedDeparture> {
  const departure = await tx.departure.findFirst({
    where: { id, tenantId },
    select: OPERATED_DEPARTURE_SELECT
  });

  if (!departure) {
    throw new NotFoundException('Departure not found');
  }

  return departure;
}

function scopeOf(departure: OperatedDeparture, actorId: string): DecisionScope {
  return { tenantId: departure.tenantId, rideId: departure.rideId, actorId };
}

/**
 * Refuses an operation on a departure it does not apply to. A `LEGACY` row is
 * the record of a bus nobody can identify any more, and is never operated on.
 */
export function assertOperable(
  departure: OperatedDeparture,
  operation: 'cancel' | 'restore' | 'editExtra' | 'deleteExtra'
): void {
  if (departure.source === DepartureSource.LEGACY) {
    throw new ConflictException({
      code: 'DEPARTURE_LEGACY',
      message: 'Ovaj polazak je sacuvan iz istorije rezervacija i ne moze se menjati.'
    });
  }

  if (operation === 'cancel' && departure.cancelledAt) {
    throw new ConflictException({ code: 'DEPARTURE_ALREADY_CANCELLED', message: 'Polazak je vec otkazan.' });
  }

  if (operation === 'restore' && !departure.cancelledAt) {
    throw new ConflictException({ code: 'DEPARTURE_NOT_CANCELLED', message: 'Polazak nije otkazan.' });
  }

  if (
    (operation === 'editExtra' || operation === 'deleteExtra') &&
    departure.source !== DepartureSource.EXTRA
  ) {
    throw new ConflictException({
      code: 'DEPARTURE_NOT_EXTRA',
      message: 'Menjati i brisati se moze samo dodatni polazak. Polazak iz reda voznje se menja u redu voznje ili otkazuje.'
    });
  }

  if (operation === 'deleteExtra' && departure._count.reservations > 0) {
    throw new ConflictException({
      code: 'DEPARTURE_HAS_RESERVATIONS',
      message:
        'Na ovom dodatnom polasku postoje rezervacije, ukljucujuci i otkazane, pa se ne moze obrisati. Otkazite ga umesto toga.'
    });
  }
}

/**
 * Refuses a departure time another departure of the ride already has that day
 * (until PR 4, a booking from the UI names its bus by that time). Cancelled
 * departures count: their passengers stay on them. So does an ADDITIONAL
 * other than the extra's own, stored extra or not: the ride screen and
 * `/rides/instances` would show it as a second bus at that time.
 *
 * With no timetable departure stored, the one the timetable would write
 * counts: the newest day between the agency's midnight and the nightly job,
 * or any day of a ride that does not run yet. Read as if the ride ran, so
 * activating it later cannot put its bus on this extra's time.
 */
async function assertDepartureTimeFree(
  tx: Tx,
  scope: DecisionScope,
  ride: GeneratorRide,
  serviceDate: Date,
  departureTime: string,
  {
    exceptDepartureId,
    exceptExceptionId
  }: { exceptDepartureId?: string; exceptExceptionId?: string | null } = {}
): Promise<void> {
  const day = formatDateOnly(serviceDate)!;
  const stored = await tx.departure.findMany({
    where: {
      tenantId: scope.tenantId,
      rideId: scope.rideId,
      serviceDate,
      source: { in: [...LINKABLE_SOURCES] },
      ...(exceptDepartureId ? { id: { not: exceptDepartureId } } : {})
    },
    select: { source: true, departureTime: true, cancelledAt: true }
  });
  const coming = stored.some((departure) => departure.source === DepartureSource.SCHEDULE)
    ? []
    : generateDepartures([asRunning(ride)], day, day).map((departure) => ({
        source: departure.source,
        departureTime: departure.departureTime,
        cancelledAt: null
      }));
  const clash = [...stored, ...coming].find(
    (departure) => departure.departureTime === departureTime
  );
  const additional = await tx.rideException.findFirst({
    where: {
      tenantId: scope.tenantId,
      rideId: scope.rideId,
      exceptionDate: serviceDate,
      type: RideExceptionType.ADDITIONAL,
      departureTime,
      ...(exceptExceptionId ? { id: { not: exceptExceptionId } } : {})
    },
    select: { id: true }
  });

  if (clash || additional) {
    throw sameTimeRefusal(
      { serviceDate: day, departureTime },
      {
        cancelledExtra:
          clash?.source === DepartureSource.EXTRA && clash.cancelledAt !== null
      }
    );
  }
}

async function loadRide(tx: Tx, scope: DecisionScope): Promise<GeneratorRide> {
  const [ride] = await loadRides(tx, scope.tenantId, scope.rideId);

  if (!ride) {
    throw new Error(`Ride ${scope.rideId} not found in tenant ${scope.tenantId}`);
  }

  return ride;
}

function assertTimesDiffer(departureTime: string, arrivalTime: string): void {
  if (departureTime === arrivalTime) {
    throw new BadRequestException(
      'Vreme polaska i vreme dolaska ne mogu biti isti (nocni polasci su dozvoljeni).'
    );
  }
}

/**
 * Cancels the date's timetable departure, credited the way the old sync
 * credited a SKIP: at the moment the exception was written, to its author.
 *
 * A date with no timetable departure stored is accepted, as before PR 3a: a
 * draft or inactive ride, a weekday the ride does not run, or the newest day
 * before the nightly job stores it. The SKIP row is then the only record, and
 * the sync applies it when it creates the departure.
 */
export async function cancelScheduledDeparture(
  tx: Tx,
  scope: DecisionScope,
  serviceDate: Date,
  cancellation: { at: Date; by: string }
): Promise<void> {
  await tx.departure.updateMany({
    where: {
      tenantId: scope.tenantId,
      rideId: scope.rideId,
      serviceDate,
      source: DepartureSource.SCHEDULE,
      cancelledAt: null
    },
    data: {
      cancelledAt: cancellation.at,
      cancelledById: cancellation.by,
      updatedById: scope.actorId
    }
  });
}

export async function restoreScheduledDeparture(
  tx: Tx,
  scope: DecisionScope,
  serviceDate: Date
): Promise<void> {
  await tx.departure.updateMany({
    where: {
      tenantId: scope.tenantId,
      rideId: scope.rideId,
      serviceDate,
      source: DepartureSource.SCHEDULE,
      cancelledAt: { not: null }
    },
    data: { cancelledAt: null, cancelledById: null, updatedById: scope.actorId }
  });
}

/**
 * Cancels a ride's timetable bus on one date: the SKIP and the departure. A
 * SKIP already there is kept as the record, so a date cancelled on one half
 * only is completed rather than recorded twice.
 */
export async function skipDate(tx: Tx, scope: DecisionScope, serviceDate: Date): Promise<ExceptionRow> {
  const skip =
    (await tx.rideException.findFirst({
      where: {
        tenantId: scope.tenantId,
        rideId: scope.rideId,
        exceptionDate: serviceDate,
        type: RideExceptionType.SKIP
      },
      select: EXCEPTION_SELECT,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    })) ??
    (await tx.rideException.create({
      data: withCreateAudit(
        {
          tenantId: scope.tenantId,
          rideId: scope.rideId,
          exceptionDate: serviceDate,
          type: RideExceptionType.SKIP,
          departureTime: null,
          arrivalTime: null
        },
        scope.actorId
      ),
      select: EXCEPTION_SELECT
    }));

  await cancelScheduledDeparture(tx, scope, serviceDate, {
    at: skip.createdAt,
    by: skip.updatedById ?? skip.createdById ?? scope.actorId
  });

  return skip;
}

/**
 * Brings a ride's timetable bus back on one date. Every SKIP on the date goes:
 * `departure.matchesExceptions` reads any one of them as a cancellation.
 */
export async function unskipDate(tx: Tx, scope: DecisionScope, serviceDate: Date): Promise<void> {
  await restoreScheduledDeparture(tx, scope, serviceDate);
  await tx.rideException.deleteMany({
    where: {
      tenantId: scope.tenantId,
      rideId: scope.rideId,
      exceptionDate: serviceDate,
      type: RideExceptionType.SKIP
    }
  });
}

/**
 * Cancels a departure (#27, PR 3d). Its passengers stay `ACTIVE` on it: the
 * caller's guard has had that confirmed, and `reservation.reachable` lists
 * them until someone moves or cancels them.
 *
 * A timetable departure gets its date's SKIP. An extra loses its ADDITIONAL,
 * which is how the ride screen has shown a cancelled extra since PR 3a.
 */
export async function cancelDeparture(
  tx: Tx,
  departure: OperatedDeparture,
  actorId: string,
  now: Date = new Date()
): Promise<void> {
  assertOperable(departure, 'cancel');
  const scope = scopeOf(departure, actorId);

  if (departure.source === DepartureSource.SCHEDULE) {
    // Credited to this operator now, even when a SKIP was already there with
    // the departure running; `skipDate` then finds nothing left to cancel.
    await tx.departure.update({
      where: { id: departure.id },
      data: { cancelledAt: now, cancelledById: actorId, updatedById: actorId }
    });
    await skipDate(tx, scope, departure.serviceDate);

    return;
  }

  await tx.departure.update({
    where: { id: departure.id },
    data: {
      cancelledAt: now,
      cancelledById: actorId,
      rideExceptionId: null,
      updatedById: actorId
    }
  });
  await releaseAdditional(tx, departure);
}

/**
 * Deletes the ADDITIONAL an extra that is going away was linked to, unless
 * another extra still links to it. Only rows stored before PR 3a share one,
 * and deleting it would unlink that bus too (`SetNull`) while it still runs.
 */
async function releaseAdditional(tx: Tx, departure: OperatedDeparture): Promise<void> {
  if (!departure.rideExceptionId) {
    return;
  }

  const sharedWith = await tx.departure.count({
    where: {
      tenantId: departure.tenantId,
      rideExceptionId: departure.rideExceptionId,
      source: DepartureSource.EXTRA,
      id: { not: departure.id }
    }
  });

  if (sharedWith === 0) {
    await tx.rideException.delete({ where: { id: departure.rideExceptionId } });
  }
}

/**
 * Brings a cancelled departure back. A timetable departure loses its date's
 * SKIP. An extra gets an ADDITIONAL again, at its own times, and must not
 * share its departure time with another departure of the ride that day.
 */
export async function restoreDeparture(
  tx: Tx,
  departure: OperatedDeparture,
  actorId: string
): Promise<void> {
  assertOperable(departure, 'restore');
  const scope = scopeOf(departure, actorId);

  if (departure.source === DepartureSource.SCHEDULE) {
    await unskipDate(tx, scope, departure.serviceDate);

    return;
  }

  await assertDepartureTimeFree(
    tx,
    scope,
    await loadRide(tx, scope),
    departure.serviceDate,
    departure.departureTime,
    { exceptDepartureId: departure.id }
  );

  const exception = await tx.rideException.create({
    data: withCreateAudit(
      {
        tenantId: scope.tenantId,
        rideId: scope.rideId,
        exceptionDate: departure.serviceDate,
        type: RideExceptionType.ADDITIONAL,
        departureTime: departure.departureTime,
        arrivalTime: departure.arrivalTime
      },
      actorId
    ),
    select: { id: true }
  });

  await tx.departure.update({
    where: { id: departure.id },
    data: {
      cancelledAt: null,
      cancelledById: null,
      rideExceptionId: exception.id,
      updatedById: actorId
    }
  });
}

export interface ExtraDecision {
  rideExceptionId: string;
  serviceDate: Date;
  departureTime: string;
  arrivalTime: string;
  /** The ride's capacity when not given. */
  capacity?: number;
}

/**
 * Inserts the extra bus an ADDITIONAL adds, with the whole line path. On a
 * ride that does not run it is inserted already dropped, and comes back with
 * the ride.
 *
 * `allowSameTime` is for fixtures that stand for a pair stored before PR 3a;
 * every request is refused one.
 */
export async function insertExtraDeparture(
  tx: Tx,
  scope: DecisionScope,
  extra: ExtraDecision,
  { now = new Date(), allowSameTime = false }: { now?: Date; allowSameTime?: boolean } = {}
): Promise<{ id: string }> {
  const ride = await loadRide(tx, scope);

  if (!allowSameTime) {
    await assertDepartureTimeFree(tx, scope, ride, extra.serviceDate, extra.departureTime, {
      exceptExceptionId: extra.rideExceptionId
    });
  }

  const { departure, dropped } = planExtra(ride, {
    keyId: extra.rideExceptionId,
    serviceDate: formatDateOnly(extra.serviceDate)!,
    departureTime: extra.departureTime,
    arrivalTime: extra.arrivalTime,
    capacity: extra.capacity ?? ride.capacity,
    rideExceptionId: extra.rideExceptionId
  });
  const id = randomUUID();

  await insertPlannedDepartures(tx, [{ id, departure, droppedAt: dropped ? now : null }], {
    tenantId: scope.tenantId,
    actorId: scope.actorId
  });

  return { id };
}

/**
 * Carries a ride's capacity edit to its extras that are still at the old
 * capacity. Until PR 4 the ride screen adds an extra through an ADDITIONAL,
 * which copies the ride's capacity, and gives nobody a way to change it, so
 * such an extra follows its ride as it did before PR 3d. An extra an operator
 * resized keeps its own. One set to exactly its ride's capacity cannot be
 * told apart and follows too.
 *
 * Past dates are the record of what ran and stay as they are. The caller's
 * guard asks before the new capacity strands a sold seat.
 */
export async function followRideCapacity(
  tx: Tx,
  scope: DecisionScope,
  { from, to }: { from: number; to: number }
): Promise<void> {
  if (from === to) {
    return;
  }

  const window = await decisionWindow(tx, scope.tenantId);

  await tx.departure.updateMany({
    where: {
      tenantId: scope.tenantId,
      rideId: scope.rideId,
      source: DepartureSource.EXTRA,
      capacity: from,
      serviceDate: { gte: utcDateOf(window.from) }
    },
    data: { capacity: to, updatedById: scope.actorId }
  });
}

function asRunning(ride: GeneratorRide): GeneratorRide {
  return { ...ride, status: RideStatus.ACTIVE, line: { ...ride.line, isActive: true } };
}

export interface NewExtra {
  serviceDate: Date;
  departureTime: string;
  arrivalTime: string;
  capacity?: number;
}

/** Adds an extra bus: its ADDITIONAL and its departure. */
export async function createExtra(
  tx: Tx,
  scope: DecisionScope,
  extra: NewExtra
): Promise<{ departureId: string; exception: ExceptionRow }> {
  assertTimesDiffer(extra.departureTime, extra.arrivalTime);

  const exception = await tx.rideException.create({
    data: withCreateAudit(
      {
        tenantId: scope.tenantId,
        rideId: scope.rideId,
        exceptionDate: extra.serviceDate,
        type: RideExceptionType.ADDITIONAL,
        departureTime: extra.departureTime,
        arrivalTime: extra.arrivalTime
      },
      scope.actorId
    ),
    select: EXCEPTION_SELECT
  });
  const { id } = await insertExtraDeparture(tx, scope, {
    rideExceptionId: exception.id,
    serviceDate: extra.serviceDate,
    departureTime: extra.departureTime,
    arrivalTime: extra.arrivalTime,
    capacity: extra.capacity
  });

  return { departureId: id, exception };
}

export interface ExtraChanges {
  departureTime?: string;
  arrivalTime?: string;
  capacity?: number;
}

/**
 * Moves an extra bus or changes its capacity. Its stops follow the new times,
 * its ADDITIONAL follows them while it has one, and so do the time copies its
 * reservations carry, as the sync does for a timetable departure (#27, PR 3b).
 * The caller's guard has asked before a booked bus moved or shrank.
 */
export async function updateExtra(
  tx: Tx,
  departure: OperatedDeparture,
  actorId: string,
  changes: ExtraChanges
): Promise<void> {
  assertOperable(departure, 'editExtra');
  const scope = scopeOf(departure, actorId);
  const departureTime = changes.departureTime ?? departure.departureTime;
  const arrivalTime = changes.arrivalTime ?? departure.arrivalTime;
  const capacity = changes.capacity ?? departure.capacity;
  const retimed =
    departureTime !== departure.departureTime || arrivalTime !== departure.arrivalTime;

  assertTimesDiffer(departureTime, arrivalTime);

  if (!retimed) {
    if (capacity !== departure.capacity) {
      await tx.departure.update({
        where: { id: departure.id },
        data: { capacity, updatedById: actorId }
      });
    }

    return;
  }

  // Read only for a move: the stops and the same-time refusal need the ride,
  // and a capacity edit needs neither while bookings wait on the lock.
  const ride = await loadRide(tx, scope);

  if (departureTime !== departure.departureTime) {
    await assertDepartureTimeFree(tx, scope, ride, departure.serviceDate, departureTime, {
      exceptDepartureId: departure.id,
      exceptExceptionId: departure.rideExceptionId
    });
  }

  // Written by the sync's own update writer, so the stops and the time copies
  // its reservations carry follow an operator's move by the same rules as a
  // timetable edit's. The extra follows its ride's line and dropped state, as
  // the next sync would make it.
  const { departure: planned, dropped } = planExtra(ride, {
    keyId: departure.id,
    serviceDate: formatDateOnly(departure.serviceDate)!,
    departureTime,
    arrivalTime,
    capacity,
    rideExceptionId: departure.rideExceptionId
  });
  const update = departureUpdate(await loadStoredDeparture(tx, departure.id), planned, dropped);

  if (update) {
    await updateDepartures(tx, [update], { tenantId: scope.tenantId, actorId }, new Date());
  }

  if (departure.rideExceptionId) {
    await tx.rideException.update({
      where: { id: departure.rideExceptionId },
      data: withUpdateAudit({ departureTime, arrivalTime }, actorId)
    });
  }
}

/**
 * Deletes an extra bus nobody was ever booked on, with its ADDITIONAL. One a
 * reservation references, a cancelled one included, is refused: it is the
 * record of the bus those passengers were sold, and is cancelled instead.
 */
export async function deleteExtra(tx: Tx, departure: OperatedDeparture): Promise<void> {
  assertOperable(departure, 'deleteExtra');
  await tx.departure.delete({ where: { id: departure.id } });
  await releaseAdditional(tx, departure);
}

/**
 * Takes away the extra bus an ADDITIONAL added, for the exception endpoint
 * that deletes the row: deleted when nothing references it, cancelled when a
 * reservation does. Either way the ADDITIONAL goes. The caller has had the
 * cancellation confirmed.
 */
export async function removeAdditional(
  tx: Tx,
  scope: DecisionScope,
  rideExceptionId: string,
  now: Date = new Date()
): Promise<'deleted' | 'cancelled' | 'none'> {
  const extras = await tx.departure.findMany({
    where: {
      tenantId: scope.tenantId,
      rideId: scope.rideId,
      rideExceptionId,
      source: DepartureSource.EXTRA
    },
    select: OPERATED_DEPARTURE_SELECT
  });
  let outcome: 'deleted' | 'cancelled' | 'none' = 'none';

  for (const extra of extras) {
    if (extra._count.reservations === 0) {
      await tx.departure.delete({ where: { id: extra.id } });
      outcome = outcome === 'none' ? 'deleted' : outcome;
      continue;
    }

    outcome = 'cancelled';

    if (!extra.cancelledAt) {
      await tx.departure.update({
        where: { id: extra.id },
        data: { cancelledAt: now, cancelledById: scope.actorId, updatedById: scope.actorId }
      });
    }
  }

  await tx.rideException.deleteMany({ where: { id: rideExceptionId, tenantId: scope.tenantId } });

  return outcome;
}
