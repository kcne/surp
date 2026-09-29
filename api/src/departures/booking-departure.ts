import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { formatDateOnly } from '../rides/ride-instance-materialization';
import { decisionWindow } from './exception-departures';
import { resolveDepartureLink } from './departure-link';

/**
 * The departure a booking is for, and the seats and route it is checked
 * against (#27, PR 3b).
 *
 * A booking names its bus by `departureId`. A tab opened before that was sent
 * names it by `rideId`, `travelDate` and `rideDepartureTime`, and is accepted
 * when exactly one departure matches, by the rule in `departure-link.ts`. The
 * copies a request carries must agree with the departure it names: a tab that
 * shows a time the timetable has since moved is refused, not booked onto a bus
 * the operator never saw.
 */

type Tx = Prisma.TransactionClient;

export interface BookingDepartureRequest {
  tenantId: string;
  departureId?: string;
  rideId: string;
  travelDate: Date;
  departureTime: string;
  arrivalTime: string;
}

const DEPARTURE_SELECT = {
  id: true,
  rideId: true,
  serviceDate: true,
  departureTime: true,
  arrivalTime: true,
  capacity: true,
  cancelledAt: true,
  timetableDroppedAt: true,
  line: { select: { isActive: true } },
  stops: {
    select: { stationId: true, orderIndex: true, isBoarding: true, isDropoff: true },
    orderBy: { orderIndex: 'asc' }
  }
} as const satisfies Prisma.DepartureSelect;

export type BookingDeparture = Prisma.DepartureGetPayload<{ select: typeof DEPARTURE_SELECT }>;

/**
 * Which departure the request names, before any lock is taken. The caller
 * locks it (`lockDepartures`) and then reads it with `loadBookingDeparture`.
 *
 * Refuses a date past the stored window with 400: nothing is stored there, so
 * nothing can be booked. A date with no departure matching the request is a
 * 409, because the bus the operator picked is not there any more.
 */
export async function resolveBookingDepartureId(
  tx: Tx,
  request: BookingDepartureRequest,
  now: Date = new Date()
): Promise<string> {
  const window = await decisionWindow(tx, request.tenantId, now);
  const day = formatDateOnly(request.travelDate)!;

  if (day > window.to) {
    throw new BadRequestException(
      `Datum ${day} je predaleko. Rezervacija se moze napraviti najkasnije za ${window.to}.`
    );
  }

  if (request.departureId) {
    return request.departureId;
  }

  const departureId = await resolveDepartureLink(tx, {
    tenantId: request.tenantId,
    rideId: request.rideId,
    travelDate: request.travelDate,
    departureTime: request.departureTime
  });

  if (!departureId) {
    throw new ConflictException({
      code: 'DEPARTURE_NOT_FOUND',
      message: `Voznja ${day} nema polazak u ${request.departureTime}. Osvezite stranicu i izaberite polazak ponovo.`
    });
  }

  return departureId;
}

/**
 * The departure, as read after its row lock. One the tenant does not have is
 * a 409 like a time nothing leaves at: a timetable edit deletes a departure
 * nobody booked, so a page loaded before it names a bus that is gone.
 */
export async function loadBookingDeparture(
  tx: Tx,
  tenantId: string,
  departureId: string
): Promise<BookingDeparture> {
  const departure = await tx.departure.findFirst({
    where: { id: departureId, tenantId },
    select: DEPARTURE_SELECT
  });

  if (!departure) {
    throw new ConflictException({
      code: 'DEPARTURE_NOT_FOUND',
      message: 'Izabrani polazak vise ne postoji. Osvezite stranicu i izaberite polazak ponovo.'
    });
  }

  return departure;
}

/**
 * Refuses a request whose copies disagree with the departure, or a departure
 * that does not run. Both are 409: the request was valid when the page was
 * loaded, and the operator needs to look again.
 */
export function assertBookable(departure: BookingDeparture, request: BookingDepartureRequest): void {
  const serviceDate = formatDateOnly(departure.serviceDate)!;
  const disagrees =
    departure.rideId !== request.rideId ||
    serviceDate !== formatDateOnly(request.travelDate) ||
    departure.departureTime !== request.departureTime ||
    departure.arrivalTime !== request.arrivalTime;

  if (disagrees) {
    throw new ConflictException({
      code: 'DEPARTURE_CHANGED',
      message: `Polazak ${serviceDate} u ${departure.departureTime} (dolazak ${departure.arrivalTime}) se ne slaze sa podacima na stranici. Osvezite stranicu i proverite polazak pre rezervacije.`
    });
  }

  assertRunning(departure);
}

export function assertRunning(
  departure: Pick<BookingDeparture, 'serviceDate' | 'departureTime' | 'cancelledAt' | 'timetableDroppedAt'>
): void {
  if (departure.cancelledAt || departure.timetableDroppedAt) {
    const serviceDate = formatDateOnly(departure.serviceDate)!;

    throw new ConflictException({
      code: 'DEPARTURE_NOT_RUNNING',
      message: departure.cancelledAt
        ? `Polazak ${serviceDate} u ${departure.departureTime} je otkazan i ne prima rezervacije.`
        : `Polazak ${serviceDate} u ${departure.departureTime} vise nije u redu voznje i ne prima rezervacije.`
    });
  }
}

export interface StopRoute {
  departureStationId: string;
  arrivalStationId: string;
  intermediateStops: Array<{ stationId: string; isBoarding: boolean; isDropoff: boolean }>;
}

/**
 * A departure's stored stops, ordered by `orderIndex`, in the shape the route
 * helpers take, so booking and the checks number a route from the same rows.
 * The generator writes the first and last stop as the termini, boarding and
 * drop-off only. Null for fewer than two stops, which only a half-written row
 * could have.
 */
export function routeFromStops(
  stops: ReadonlyArray<{ stationId: string; isBoarding: boolean; isDropoff: boolean }>
): StopRoute | null {
  if (stops.length < 2) {
    return null;
  }

  return {
    departureStationId: stops[0].stationId,
    arrivalStationId: stops[stops.length - 1].stationId,
    intermediateStops: stops.slice(1, -1).map(({ stationId, isBoarding, isDropoff }) => ({
      stationId,
      isBoarding,
      isDropoff
    }))
  };
}

export function departureRoute(
  stops: ReadonlyArray<{ stationId: string; isBoarding: boolean; isDropoff: boolean }>
): StopRoute {
  const route = routeFromStops(stops);

  if (!route) {
    throw new ConflictException({
      code: 'DEPARTURE_ROUTE_MISSING',
      message: 'Polazak nema sacuvanu rutu. Javite podrsci.'
    });
  }

  return route;
}
