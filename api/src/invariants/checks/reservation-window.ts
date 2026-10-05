import { Prisma, ReservationStatus, RideStatus } from '@prisma/client';
import {
  baseInstanceForDate,
  dayOfWeekOf,
  formatDateOnly,
  utcDateOf
} from '../../rides/ride-instance-materialization';
import { StopRoute, routeFromStops } from '../../departures/booking-departure';
import { agencyDate, resolveAgencyTimezone } from '../../departures/agency-date';
import { InvariantContext } from '../invariant.types';
import { RideDayInstances } from './orphaned-reservations';

/**
 * Loads the slice of data every reservation-level check works from: active
 * reservations travelling inside the window, the rides behind them, and the
 * departures they are on.
 */

const RESERVATION_SELECT = {
  id: true,
  rideId: true,
  departureId: true,
  travelDate: true,
  rideDepartureTime: true,
  rideArrivalTime: true,
  seatNumber: true,
  departureStationId: true,
  arrivalStationId: true,
  passenger: { select: { id: true, firstName: true, lastName: true, phone: true, isActive: true } }
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
      isActive: true,
      departureStationId: true,
      arrivalStationId: true,
      // Ordered, because the seat checks number the route from these to work
      // out which reservations share a stretch of it. isBoarding/isDropoff ride
      // along for the segment checks, which need to know whether a station can
      // still be boarded at or got off at.
      intermediateStops: {
        select: { stationId: true, isBoarding: true, isDropoff: true },
        orderBy: { orderIndex: 'asc' }
      }
    }
  },
  daySchedules: {
    select: {
      dayOfWeek: true,
      stationTimes: { select: { orderIndex: true, time: true } }
    }
  }
} as const;

const DEPARTURE_SELECT = {
  id: true,
  source: true,
  departureTime: true,
  arrivalTime: true,
  capacity: true,
  cancelledAt: true,
  timetableDroppedAt: true,
  stops: {
    select: { stationId: true, isBoarding: true, isDropoff: true },
    orderBy: { orderIndex: 'asc' }
  }
} as const;

export type WindowedDeparture = Prisma.DepartureGetPayload<{ select: typeof DEPARTURE_SELECT }>;

export type WindowedRoute = StopRoute;

export type WindowedReservation = Prisma.ReservationGetPayload<{
  select: typeof RESERVATION_SELECT;
}> & { travelDate: Date };

export type WindowedRide = Prisma.RideGetPayload<{ select: typeof RIDE_SELECT }>;

export interface ReservationWindow {
  windowStartDate: string;
  windowEndDate: string;
  reservations: WindowedReservation[];
  rideOf(reservation: WindowedReservation): WindowedRide | undefined;
  /**
   * The stored departure a reservation is on (#27). Seats are counted on it
   * and its stops are the route, so the checks judge the bus the booking was
   * checked against rather than the timetable's reading of it.
   */
  departureOf(reservation: WindowedReservation): WindowedDeparture;
  /**
   * The route the reservation's stations are read against: its departure's
   * stored stops, or its ride's line for a departure stored without them.
   */
  routeOf(reservation: WindowedReservation, ride: WindowedRide): WindowedRoute;
  /** Whether the ride is active, and what its schedule says of one travel date. */
  dayOf(ride: WindowedRide, travelDate: string): RideDayInstances;
}

/**
 * One window per context, shared by every check running against it.
 *
 * Five invariants on a ride update meant five identical scans of the same
 * rows, and a prospective write runs the whole set twice. Keyed by context for
 * the same reason `seat-occupancy` is: a fresh context per request, and a new
 * one before a repair re-checks, is what keeps a repaired violation from being
 * read back out of this cache.
 */
const windowByContext = new WeakMap<InvariantContext, Promise<ReservationWindow>>();

export function loadReservationWindow(ctx: InvariantContext): Promise<ReservationWindow> {
  const cached = windowByContext.get(ctx);

  if (cached) {
    return cached;
  }

  // The promise is cached, not the result, so checks starting at once share
  // one load rather than racing to start their own.
  const window = buildReservationWindow(ctx);
  windowByContext.set(ctx, window);

  return window;
}

async function buildReservationWindow(ctx: InvariantContext): Promise<ReservationWindow> {
  const tenant = await ctx.prisma.tenant.findUniqueOrThrow({
    where: { id: ctx.tenantId },
    select: { timezone: true }
  });
  const today = agencyDate(new Date(), resolveAgencyTimezone(tenant.timezone).timezone);
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
          select: RIDE_SELECT
        });

  const rideById = new Map(rides.map((ride) => [ride.id, ride]));
  const departureIds = [...new Set(reservations.map((reservation) => reservation.departureId))];
  const departures =
    departureIds.length === 0
      ? []
      : await ctx.prisma.departure.findMany({
          where: { id: { in: departureIds }, tenantId: ctx.tenantId },
          select: DEPARTURE_SELECT
        });
  const departureById = new Map(departures.map((departure) => [departure.id, departure]));
  const routeByDepartureId = new Map<string, WindowedRoute>();

  // A busy ride can carry dozens of reservations on the same day.
  const dayCache = new Map<string, RideDayInstances>();

  // The foreign key makes a missing departure impossible, so one is a bug in
  // the load above, not drift to report.
  const departureOf = (reservation: WindowedReservation): WindowedDeparture => {
    const departure = departureById.get(reservation.departureId);

    if (!departure) {
      throw new Error(
        `Departure ${reservation.departureId} of reservation ${reservation.id} was not loaded`
      );
    }

    return departure;
  };

  return {
    windowStartDate: today,
    windowEndDate,
    reservations,
    rideOf: (reservation) => rideById.get(reservation.rideId),
    departureOf,
    routeOf: (reservation, ride) => {
      const departure = departureOf(reservation);
      const cached = routeByDepartureId.get(departure.id);

      if (cached) {
        return cached;
      }

      // A LEGACY departure is stored without stops, and a half-written one has
      // fewer than its two termini. The line is a better guess for either
      // than a route of nothing.
      const route = routeFromStops(departure.stops) ?? ride.line;

      routeByDepartureId.set(departure.id, route);

      return route;
    },
    dayOf: (ride, travelDate) => {
      const key = `${ride.id}:${travelDate}`;
      const cached = dayCache.get(key);

      if (cached) {
        return cached;
      }

      const day: RideDayInstances = {
        rideIsActive: ride.status === RideStatus.ACTIVE,
        baseInstance: baseInstanceForDate(ride, travelDate, dayOfWeekOf(travelDate))
      };

      dayCache.set(key, day);

      return day;
    }
  };
}
