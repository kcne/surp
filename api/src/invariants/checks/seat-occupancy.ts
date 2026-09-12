import { formatDateOnly } from '../../rides/ride-instance-materialization';
import { RouteSegment, routeStationOrder } from '../../reservations/route-segment';
import { InvariantContext } from '../invariant.types';
import { classifyReservation } from './orphaned-reservations';
import { loadReservationWindow, WindowedRide } from './reservation-window';

/**
 * Who is sitting where, on every departure inside the window.
 *
 * The three seat checks — `reservation.seatUnique`,
 * `reservation.seatWithinCapacity` and `instance.notOverbooked` — all need the
 * same thing first: the set of reservations that will share one physical bus,
 * each with the stretch of route it occupies a seat for. Building it once means
 * the three of them cannot disagree about which passengers are on the same bus.
 *
 * That grouping is the whole point of these checks. The application groups by
 * the stored `rideId : travelDate : rideDepartureTime`, and so does the
 * advisory lock taken before a booking is accepted. When a route edit moves the
 * departure time, reservations booked before the edit keep the old time and the
 * one bus splits into two locking domains: a booking taken in one cannot see
 * the seats held in the other, and the seat is sold twice. That is how 40 seats
 * were resold in #14.
 *
 * So this resolves each reservation onto the instance that will actually carry
 * it, not the one its stored string names, and puts the drifted reservations
 * back beside the current ones where the clash is visible.
 */

export interface OccupiedSeat {
  reservationId: string;
  passengerName: string;
  passengerPhone: string;
  seatNumber: number;
  departureStationId: string;
  arrivalStationId: string;
  /** The stretch of route this passenger is aboard for. */
  segment: RouteSegment;
  /**
   * False when a station is no longer on the route and the segment had to be
   * assumed. See `wholeRoute` below.
   */
  segmentKnown: boolean;
  /** The time the row carries, which may no longer name a departure. */
  storedDepartureTime: string;
  /** Whether the stored time had to be resolved to a different departure. */
  drifted: boolean;
}

export interface InstanceOccupancy {
  /** `rideId : travelDate : departureTime`, the key the app joins on. */
  instanceKey: string;
  rideId: string;
  rideName: string;
  lineName: string;
  travelDate: string;
  departureTime: string;
  capacity: number;
  /** The route in order, so a leg can be named by the two stations it joins. */
  stationIds: string[];
  seats: OccupiedSeat[];
}

export interface OccupancyScan {
  instances: InstanceOccupancy[];
  scannedReservationCount: number;
}

/**
 * The scan, built once per context and handed to all three checks.
 *
 * They run one after another against the same `InvariantContext`, so without
 * this the window is queried three times over and the claim above — that the
 * three cannot disagree about who shares a bus — holds only by luck. Keyed on
 * the context object rather than the tenant so it cannot outlive the report it
 * was built for: `InvariantsService` mints a fresh context per request, and a
 * repair takes a new one before re-checking, which is what keeps a repaired
 * violation from being read back out of this cache.
 */
const scanByContext = new WeakMap<InvariantContext, Promise<OccupancyScan>>();

/**
 * Groups every active reservation in the window onto the departure that will
 * carry it.
 *
 * A reservation no departure can be found for is left out entirely: which bus
 * it belongs on is exactly what `reservation.reachable` reports and repairs,
 * and counting it here would name the same passenger under a heading that
 * understates the problem.
 */
export function loadInstanceOccupancy(ctx: InvariantContext): Promise<OccupancyScan> {
  const cached = scanByContext.get(ctx);

  if (cached) {
    return cached;
  }

  // The promise is cached, not the result, so three checks starting at once
  // still share one load rather than racing to start their own.
  const scan = scanInstanceOccupancy(ctx);
  scanByContext.set(ctx, scan);

  return scan;
}

async function scanInstanceOccupancy(ctx: InvariantContext): Promise<OccupancyScan> {
  const window = await loadReservationWindow(ctx);
  const byKey = new Map<string, InstanceOccupancy>();
  // One numbering per ride rather than per reservation: a busy ride carries
  // hundreds of them and the route behind it does not change mid-scan.
  const stationOrderByRideId = new Map<string, Map<string, number>>();

  for (const reservation of window.reservations) {
    const travelDate = formatDateOnly(reservation.travelDate)!;
    const ride = window.rideOf(reservation);

    if (!ride) {
      continue;
    }

    const day = window.dayOf(ride, travelDate);
    const classification = classifyReservation({ ...reservation, travelDate }, day);
    const departureTime = classification
      ? classification.targetDepartureTime
      : reservation.rideDepartureTime;

    if (!departureTime) {
      continue;
    }

    const instanceKey = `${ride.id}:${travelDate}:${departureTime}`;
    const instance = byKey.get(instanceKey) ?? emptyInstance(ride, travelDate, departureTime);
    const stationOrderById =
      stationOrderByRideId.get(ride.id) ??
      stationOrderByRideId.set(ride.id, routeStationOrder(ride.line)).get(ride.id)!;
    const departureOrder = stationOrderById.get(reservation.departureStationId);
    const arrivalOrder = stationOrderById.get(reservation.arrivalStationId);

    instance.seats.push({
      reservationId: reservation.id,
      passengerName: `${reservation.passenger.firstName} ${reservation.passenger.lastName}`,
      passengerPhone: reservation.passenger.phone,
      seatNumber: reservation.seatNumber,
      departureStationId: reservation.departureStationId,
      arrivalStationId: reservation.arrivalStationId,
      segment:
        departureOrder !== undefined && arrivalOrder !== undefined
          ? { departureOrder, arrivalOrder }
          : wholeRoute(instance.stationIds.length - 1),
      segmentKnown: departureOrder !== undefined && arrivalOrder !== undefined,
      storedDepartureTime: reservation.rideDepartureTime,
      drifted: departureTime !== reservation.rideDepartureTime
    });

    byKey.set(instanceKey, instance);
  }

  return {
    instances: [...byKey.values()],
    scannedReservationCount: window.reservations.length
  };
}

function emptyInstance(
  ride: WindowedRide,
  travelDate: string,
  departureTime: string
): InstanceOccupancy {
  return {
    instanceKey: `${ride.id}:${travelDate}:${departureTime}`,
    rideId: ride.id,
    rideName: ride.name,
    lineName: ride.line.name,
    travelDate,
    departureTime,
    capacity: ride.capacity,
    stationIds: [
      ride.line.departureStationId,
      ...ride.line.intermediateStops.map((stop) => stop.stationId),
      ride.line.arrivalStationId
    ],
    seats: []
  };
}

/**
 * The segment assumed for a reservation whose stations are no longer on the
 * route.
 *
 * Booking takes the same stance — `ensureSeatAndCapacityAreAvailable` treats a
 * station it cannot place as a conflict — and it is the safe direction to be
 * wrong in: the passenger is aboard for some part of the trip and nothing left
 * in the data says which, so the seat is counted as held for all of it.
 */
function wholeRoute(lastStationOrder: number): RouteSegment {
  return { departureOrder: 0, arrivalOrder: lastStationOrder };
}

/** Names one leg of a route, for a report an agency has to act on. */
export function legLabel(
  instance: InstanceOccupancy,
  order: number,
  toName: (stationId: string) => string
): string {
  return `${toName(instance.stationIds[order])} - ${toName(instance.stationIds[order + 1])}`;
}
