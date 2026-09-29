import { BadRequestException } from '@nestjs/common';
import { DepartureSource, Prisma, RideStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { formatDateOnly } from '../rides/ride-instance-materialization';
import { DepartureWindow, departureWindow, resolveAgencyTimezone } from './agency-date';
import { GeneratorRide, generateDepartures, planExtra } from './departure-generator';
import { LINKABLE_SOURCES } from './departure-link';
import { insertPlannedDepartures, loadRides, sameTimeRefusal } from './departure-sync';

/**
 * The departure half of an operator decision (#27, PR 3a).
 *
 * A cancelled date or an extra bus is written on the departure by whoever
 * decides it, because the sync no longer reads `RideException`. Until PR 6
 * every decision also keeps its exception row, which `/rides/instances` and
 * the ride screen still read, and `departure.matchesExceptions` checks that
 * the two agree. The exception endpoints and the fixtures both write through
 * here, so neither can record one half without the other.
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
      `Datum ${day} je van dozvoljenog opsega. Izuzetak se moze dodati ili ukloniti samo od ${window.from} do ${window.to}.`
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
      source: DepartureSource.SCHEDULE
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

export interface ExtraDecision {
  rideExceptionId: string;
  serviceDate: Date;
  departureTime: string;
  arrivalTime: string;
}

/**
 * Inserts the extra bus an ADDITIONAL adds, with the ride's capacity and the
 * whole line path. On a ride that does not run it is inserted already
 * dropped, and comes back with the ride.
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
  const [ride] = await loadRides(tx, scope.tenantId, scope.rideId);
  const serviceDate = formatDateOnly(extra.serviceDate)!;

  if (!ride) {
    throw new Error(`Ride ${scope.rideId} not found in tenant ${scope.tenantId}`);
  }

  if (!allowSameTime) {
    const stored = await tx.departure.findMany({
      where: {
        tenantId: scope.tenantId,
        rideId: scope.rideId,
        serviceDate: extra.serviceDate,
        source: { in: [...LINKABLE_SOURCES] }
      },
      select: { source: true, departureTime: true, cancelledAt: true }
    });
    // With no timetable departure stored, the one the timetable would write
    // counts: the newest day between the agency's midnight and the nightly
    // job, or any day of a ride that does not run yet. Read as if the ride
    // ran, so activating it later cannot put its bus on this extra's time.
    const coming = stored.some((departure) => departure.source === DepartureSource.SCHEDULE)
      ? []
      : generateDepartures([asRunning(ride)], serviceDate, serviceDate).map((departure) => ({
          source: departure.source,
          departureTime: departure.departureTime,
          cancelledAt: null
        }));
    const clash = [...stored, ...coming].find(
      (departure) => departure.departureTime === extra.departureTime
    );

    if (clash) {
      throw sameTimeRefusal(
        { serviceDate, departureTime: extra.departureTime },
        { cancelledExtra: clash.source === DepartureSource.EXTRA && clash.cancelledAt !== null }
      );
    }
  }

  const { departure, dropped } = planExtra(ride, {
    keyId: extra.rideExceptionId,
    serviceDate,
    departureTime: extra.departureTime,
    arrivalTime: extra.arrivalTime,
    capacity: ride.capacity,
    rideExceptionId: extra.rideExceptionId
  });
  const id = randomUUID();

  await insertPlannedDepartures(tx, [{ id, departure, droppedAt: dropped ? now : null }], {
    tenantId: scope.tenantId,
    actorId: scope.actorId
  });

  return { id };
}

function asRunning(ride: GeneratorRide): GeneratorRide {
  return { ...ride, status: RideStatus.ACTIVE, line: { ...ride.line, isActive: true } };
}

/**
 * Takes away the extra bus an ADDITIONAL added, before the exception row is
 * deleted. Nothing references it: it is deleted. A reservation does, cancelled
 * ones included: it is kept and cancelled, so the bus those passengers were
 * sold stays on record. The caller has had the removal confirmed.
 */
export async function retireExtraDeparture(
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
    select: { id: true, cancelledAt: true, _count: { select: { reservations: true } } }
  });

  if (extras.length === 0) {
    return 'none';
  }

  let outcome: 'deleted' | 'cancelled' = 'deleted';

  for (const extra of extras) {
    if (extra._count.reservations === 0) {
      await tx.departure.delete({ where: { id: extra.id } });
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

  return outcome;
}
