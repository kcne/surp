import { ReservationStatus, RideStatus } from '@prisma/client';
import { withUpdateAudit } from '../../prisma/audit-write.helper';
import {
  dayOfWeekOf,
  formatDateOnly,
  materializeInstanceTimesForDate,
  utcDateOf
} from '../../rides/ride-instance-materialization';
import {
  classifyReservation,
  findOffRouteStationIds,
  resolveSeatNumber,
  type OrphanReason
} from './orphaned-reservations';
import { CheckResult, Invariant, InvariantContext, RepairResult } from '../invariant.types';
import { loadStationNames } from './tenant-lookups';

/**
 * A reservation is only ever reached through a ride instance, and instances are
 * derived on read rather than stored. The join key is
 * `rideId : travelDate : rideDepartureTime`, so a reservation whose stored
 * departure time no longer matches any instance on its own travel date is
 * invisible everywhere in the app while still sitting in the database, holding
 * its seat against a capacity nobody can see.
 *
 * Editing a route is enough to cause it: the instance departure time is the
 * first station's time, so putting a new station at the head of a line renames
 * every instance on it and strands every reservation booked before the change.
 */

export interface OrphanedReservationItem {
  reservationId: string;
  passengerName: string;
  passengerPhone: string;
  travelDate: string;
  rideName: string;
  lineName: string;
  departureStationName: string;
  arrivalStationName: string;
  currentDepartureTime: string;
  targetDepartureTime: string | null;
  targetArrivalTime: string | null;
  seatNumber: number;
  targetSeatNumber: number | null;
  reason: string;
  canRepair: boolean;
  offRouteStationNames: string[];
}

export interface OrphanReport {
  windowStartDate: string;
  windowEndDate: string;
  scannedReservationCount: number;
  orphanedCount: number;
  repairableCount: number;
  seatChangeCount: number;
  items: OrphanedReservationItem[];
}

export interface OrphanRepairOutcome {
  repairedCount: number;
  seatChangedCount: number;
  skippedCount: number;
  items: OrphanedReservationItem[];
}

export async function buildOrphanReport(ctx: InvariantContext): Promise<OrphanReport> {
  const scan = await scanForOrphans(ctx);

  return {
    windowStartDate: scan.windowStartDate,
    windowEndDate: scan.windowEndDate,
    scannedReservationCount: scan.scannedReservationCount,
    orphanedCount: scan.items.length,
    repairableCount: scan.items.filter((item) => item.canRepair).length,
    seatChangeCount: scan.items.filter(
      (item) => item.canRepair && item.targetSeatNumber !== item.seatNumber
    ).length,
    items: scan.items
  };
}

/**
 * Moves every orphan a single instance can claim onto that instance.
 *
 * The scan is re-run here rather than trusting a report the caller may have
 * loaded minutes ago, so seat assignments are decided against the current
 * state of the bus.
 */
export async function repairOrphanedReservations(
ctx: InvariantContext
): Promise<OrphanRepairOutcome> {
  const scan = await scanForOrphans(ctx);

  let repairedCount = 0;
  let seatChangedCount = 0;
  let skippedCount = 0;

  for (const item of scan.items) {
    if (!item.canRepair || !item.targetDepartureTime || item.targetSeatNumber === null) {
      skippedCount += 1;
      continue;
    }

    // One reservation per transaction: a single failure must not roll back
    // passengers already made visible again.
    await ctx.prisma.reservation.update({
      where: { id: item.reservationId },
      data: withUpdateAudit(
        {
          rideDepartureTime: item.targetDepartureTime,
          rideArrivalTime: item.targetArrivalTime ?? undefined,
          seatNumber: item.targetSeatNumber
        },
        ctx.actorId
      )
    });

    repairedCount += 1;

    if (item.targetSeatNumber !== item.seatNumber) {
      seatChangedCount += 1;
    }
  }

  return {
    repairedCount,
    seatChangedCount,
    skippedCount,
    items: scan.items
  };
}

/**
 * Walks every active reservation travelling inside the window and asks which
 * ride instance, if any, can still reach it.
 */
export async function scanForOrphans(ctx: InvariantContext): Promise<{
  windowStartDate: string;
  windowEndDate: string;
  scannedReservationCount: number;
  items: OrphanedReservationItem[];
}> {
  const today = formatDateOnly(new Date())!;
  const windowStart = utcDateOf(today);
  const windowEnd = new Date(windowStart);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + ctx.windowDays);
  const windowEndDate = formatDateOnly(windowEnd)!;

  const reservations = await ctx.prisma.reservation.findMany({
    where: {
      tenantId: ctx.tenantId,
      status: ReservationStatus.ACTIVE,
      travelDate: { gte: windowStart, lte: windowEnd }
    },
    select: {
      id: true,
      rideId: true,
      travelDate: true,
      rideDepartureTime: true,
      rideArrivalTime: true,
      seatNumber: true,
      departureStationId: true,
      arrivalStationId: true,
      passenger: { select: { firstName: true, lastName: true, phone: true } }
    },
    // A stable order makes the report and the repair assign the same seats.
    orderBy: [{ travelDate: 'asc' }, { seatNumber: 'asc' }, { id: 'asc' }]
  });

  if (reservations.length === 0) {
    return {
      windowStartDate: today,
      windowEndDate,
      scannedReservationCount: 0,
      items: []
    };
  }

  const rideIds = [...new Set(reservations.map((reservation) => reservation.rideId))];
  const rides = await ctx.prisma.ride.findMany({
    where: { id: { in: rideIds }, tenantId: ctx.tenantId },
    select: {
      id: true,
      name: true,
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
          name: true,
          departureStationId: true,
          arrivalStationId: true,
          intermediateStops: { select: { stationId: true } }
        }
      },
      daySchedules: {
        select: {
          dayOfWeek: true,
          stationTimes: { select: { orderIndex: true, time: true } }
        }
      },
      exceptions: {
        where: { exceptionDate: { gte: windowStart, lte: windowEnd } },
        select: { exceptionDate: true, type: true, departureTime: true, arrivalTime: true },
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  const rideById = new Map(rides.map((ride) => [ride.id, ride]));
  const stationNameById = await loadStationNames(ctx);

  // Instances are derived per ride and date, so cache them: a busy ride can
  // carry dozens of reservations on the same day.
  const instanceCache = new Map<string, ReturnType<typeof materializeInstanceTimesForDate>>();

  const instancesFor = (ride: (typeof rides)[number], travelDate: string) => {
    const key = `${ride.id}:${travelDate}`;
    const cached = instanceCache.get(key);

    if (cached) {
      return cached;
    }

    const exceptionsForDate = ride.exceptions.filter(
      (exception) => formatDateOnly(exception.exceptionDate) === travelDate
    );
    const materialized = materializeInstanceTimesForDate(
      ride,
      exceptionsForDate,
      travelDate,
      dayOfWeekOf(travelDate)
    );

    instanceCache.set(key, materialized);

    return materialized;
  };

  // Seats already spoken for on each instance, so a repair never lands a
  // passenger on top of one who is currently visible.
  const occupiedSeats = new Map<string, Set<number>>();

  const claimSeat = (rideId: string, travelDate: string, departureTime: string, seat: number) => {
    const key = `${rideId}:${travelDate}:${departureTime}`;
    const seats = occupiedSeats.get(key) ?? new Set<number>();
    seats.add(seat);
    occupiedSeats.set(key, seats);
    return seats;
  };

  const orphanCandidates: Array<{
    reservation: (typeof reservations)[number];
    travelDate: string;
    ride: (typeof rides)[number];
    reason: OrphanReason;
    targetDepartureTime: string | null;
    targetArrivalTime: string | null;
  }> = [];

  for (const reservation of reservations) {
    const travelDate = formatDateOnly(reservation.travelDate)!;
    const ride = rideById.get(reservation.rideId);

    if (!ride) {
      continue;
    }

    const classification = classifyReservation(
      { ...reservation, travelDate },
      {
        rideIsActive: ride.status === RideStatus.ACTIVE,
        instances: instancesFor(ride, travelDate)
      }
    );

    if (!classification) {
      // Reachable today, so its seat is genuinely taken.
      claimSeat(reservation.rideId, travelDate, reservation.rideDepartureTime, reservation.seatNumber);
      continue;
    }

    orphanCandidates.push({
      reservation,
      travelDate,
      ride,
      reason: classification.reason,
      targetDepartureTime: classification.targetDepartureTime,
      targetArrivalTime: classification.targetArrivalTime
    });
  }

  // Seats are resolved only after every visible reservation has claimed its
  // own, so an orphan never wins a seat that a visible passenger holds.
  //
  // Orphans are then resolved in two passes rather than one. A single pass
  // lets an orphan whose seat was taken grab the lowest free seat, which is
  // often a seat another orphan could still have kept — moving one passenger
  // then cascades into moving several. Letting everyone who can keep their
  // seat claim it first cut the moves on the tenant this was built for from
  // 66 to 39, and every avoided move is a passenger nobody has to call.
  const seatByReservationId = new Map<string, number | null>();
  const needsAnotherSeat: typeof orphanCandidates = [];

  for (const candidate of orphanCandidates) {
    const { reservation, ride, travelDate, targetDepartureTime } = candidate;

    if (!targetDepartureTime) {
      seatByReservationId.set(reservation.id, null);
      continue;
    }

    const key = `${reservation.rideId}:${travelDate}:${targetDepartureTime}`;
    const taken = occupiedSeats.get(key) ?? new Set<number>();

    if (reservation.seatNumber <= ride.capacity && !taken.has(reservation.seatNumber)) {
      seatByReservationId.set(reservation.id, reservation.seatNumber);
      claimSeat(reservation.rideId, travelDate, targetDepartureTime, reservation.seatNumber);
      continue;
    }

    needsAnotherSeat.push(candidate);
  }

  for (const candidate of needsAnotherSeat) {
    const { reservation, ride, travelDate, targetDepartureTime } = candidate;
    const key = `${reservation.rideId}:${travelDate}:${targetDepartureTime!}`;
    const seat = resolveSeatNumber(
      reservation.seatNumber,
      occupiedSeats.get(key) ?? new Set<number>(),
      ride.capacity
    );

    seatByReservationId.set(reservation.id, seat);

    if (seat !== null) {
      claimSeat(reservation.rideId, travelDate, targetDepartureTime!, seat);
    }
  }

  const items: OrphanedReservationItem[] = orphanCandidates.map((candidate) => {
    const { reservation, ride, travelDate, targetDepartureTime } = candidate;
    const routeStationIds = new Set<string>([
      ride.line.departureStationId,
      ride.line.arrivalStationId,
      ...ride.line.intermediateStops.map((stop) => stop.stationId)
    ]);

    const targetSeatNumber = seatByReservationId.get(reservation.id) ?? null;
    const stationName = (stationId: string) => stationNameById.get(stationId) ?? stationId;

    return {
      reservationId: reservation.id,
      passengerName: `${reservation.passenger.firstName} ${reservation.passenger.lastName}`,
      passengerPhone: reservation.passenger.phone,
      travelDate,
      rideName: ride.name,
      lineName: ride.line.name,
      departureStationName: stationName(reservation.departureStationId),
      arrivalStationName: stationName(reservation.arrivalStationId),
      currentDepartureTime: reservation.rideDepartureTime,
      targetDepartureTime,
      targetArrivalTime: candidate.targetArrivalTime,
      seatNumber: reservation.seatNumber,
      targetSeatNumber,
      reason: candidate.reason,
      canRepair: targetDepartureTime !== null && targetSeatNumber !== null,
      offRouteStationNames: findOffRouteStationIds(
        { ...reservation, travelDate },
        routeStationIds
      ).map(stationName)
    };
  });

  return {
    windowStartDate: today,
    windowEndDate,
    scannedReservationCount: reservations.length,
    items
  };
}

export const reservationReachable: Invariant = {
  key: 'reservation.reachable',
  title: 'Rezervacija se vidi na svom polasku',
  description:
    'Rezervacija se vezuje za polazak preko vremena polaska, a to vreme se racuna iz prve stanice na ruti. Kada se ruta ili raspored promene, polazak dobija novo vreme i rezervacija nestaje sa svih spiskova, iako je i dalje u bazi i i dalje drzi sediste.',
  severity: 'critical',

  async check(ctx: InvariantContext): Promise<CheckResult> {
    const report = await buildOrphanReport(ctx);

    return {
      scannedCount: report.scannedReservationCount,
      violations: report.items.map((item) => ({
        subjectType: 'reservation' as const,
        subjectId: item.reservationId,
        summary: `${item.passengerName}, ${item.travelDate}, polazak ${item.currentDepartureTime} vise ne postoji.`,
        detail: { ...item },
        canRepair: item.canRepair
      }))
    };
  },

  async repair(ctx: InvariantContext): Promise<RepairResult> {
    const { repairedCount, skippedCount } = await repairOrphanedReservations(ctx);

    return { repairedCount, skippedCount };
  }
};
