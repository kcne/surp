import { Prisma, ReservationStatus, RideExceptionType, RideStatus } from '@prisma/client';
import {
  baseInstanceForDate,
  dayOfWeekOf,
  formatDateOnly,
  materializeInstanceTimesForDate,
  utcDateOf
} from '../../rides/ride-instance-materialization';
import { InvariantContext } from '../invariant.types';
import { RideDayInstances } from './orphaned-reservations';

/**
 * Loads the slice of data every reservation-level check works from: active
 * reservations travelling inside the window, the rides behind them, and the
 * instances each of those rides materializes on each travel date.
 *
 * The instances are the part worth sharing. They are derived on read, so a
 * check that derived them its own way would disagree with the app about which
 * departures exist — and disagreeing about that is the whole incident this
 * epic exists to prevent.
 */

const RESERVATION_SELECT = {
  id: true,
  rideId: true,
  travelDate: true,
  rideDepartureTime: true,
  rideArrivalTime: true,
  seatNumber: true,
  departureStationId: true,
  arrivalStationId: true,
  passenger: { select: { firstName: true, lastName: true, phone: true } }
} as const;

const RIDE_SELECT = {
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
  }
} as const;

export type WindowedReservation = Prisma.ReservationGetPayload<{
  select: typeof RESERVATION_SELECT;
}> & { travelDate: Date };

export interface WindowedException {
  exceptionDate: Date;
  type: RideExceptionType;
  departureTime: string | null;
  arrivalTime: string | null;
}

export type WindowedRide = Prisma.RideGetPayload<{ select: typeof RIDE_SELECT }> & {
  /** Narrowed to the window, so a ride with years of history stays cheap. */
  exceptions: WindowedException[];
};

export interface ReservationWindow {
  windowStartDate: string;
  windowEndDate: string;
  reservations: WindowedReservation[];
  rideOf(reservation: WindowedReservation): WindowedRide | undefined;
  /** What the ride does on one travel date: instances, plus why, if none. */
  dayOf(ride: WindowedRide, travelDate: string): RideDayInstances;
}

export async function loadReservationWindow(ctx: InvariantContext): Promise<ReservationWindow> {
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
    select: RESERVATION_SELECT,
    // A stable order makes the report and the repair assign the same seats.
    orderBy: [{ travelDate: 'asc' }, { seatNumber: 'asc' }, { id: 'asc' }]
  });

  const rideIds = [...new Set(reservations.map((reservation) => reservation.rideId))];
  const rides =
    rideIds.length === 0
      ? []
      : await ctx.prisma.ride.findMany({
          where: { id: { in: rideIds }, tenantId: ctx.tenantId },
          select: {
            ...RIDE_SELECT,
            exceptions: {
              where: { exceptionDate: { gte: windowStart, lte: windowEnd } },
              select: { exceptionDate: true, type: true, departureTime: true, arrivalTime: true },
              orderBy: { createdAt: 'asc' }
            }
          }
        });

  const rideById = new Map(rides.map((ride) => [ride.id, ride]));

  // Instances are derived per ride and date, so cache them: a busy ride can
  // carry dozens of reservations on the same day.
  const dayCache = new Map<string, RideDayInstances>();

  return {
    windowStartDate: today,
    windowEndDate,
    reservations,
    rideOf: (reservation) => rideById.get(reservation.rideId),
    dayOf: (ride, travelDate) => {
      const key = `${ride.id}:${travelDate}`;
      const cached = dayCache.get(key);

      if (cached) {
        return cached;
      }

      const exceptionsForDate = ride.exceptions.filter(
        (exception) => formatDateOnly(exception.exceptionDate) === travelDate
      );
      const dayOfWeek = dayOfWeekOf(travelDate);
      const day: RideDayInstances = {
        rideIsActive: ride.status === RideStatus.ACTIVE,
        instances: materializeInstanceTimesForDate(ride, exceptionsForDate, travelDate, dayOfWeek),
        baseInstance: baseInstanceForDate(ride, travelDate, dayOfWeek),
        skippedByException: exceptionsForDate.some(
          (exception) => exception.type === RideExceptionType.SKIP
        )
      };

      dayCache.set(key, day);

      return day;
    }
  };
}
