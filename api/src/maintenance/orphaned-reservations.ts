import { MaterializedInstanceTimes } from '../rides/ride-instance-materialization';

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

export type OrphanReason =
  /** Exactly one instance runs that day — the reservation can be moved onto it. */
  | 'DEPARTURE_TIME_MOVED'
  /** Several instances run that day and nothing says which one was booked. */
  | 'AMBIGUOUS_INSTANCE'
  /** No instance at all: a SKIP exception, a date outside the recurring range, a
   *  weekday with no schedule, or a schedule missing its first or last time. */
  | 'NO_INSTANCE'
  /** The ride itself is DRAFT or INACTIVE, so it materializes nowhere. */
  | 'RIDE_NOT_ACTIVE';

export interface ReservationToCheck {
  id: string;
  rideId: string;
  travelDate: string;
  rideDepartureTime: string;
  rideArrivalTime: string;
  seatNumber: number;
  departureStationId: string;
  arrivalStationId: string;
}

export interface OrphanClassification {
  reason: OrphanReason;
  targetDepartureTime: string | null;
  targetArrivalTime: string | null;
}

export interface RideDayInstances {
  rideIsActive: boolean;
  instances: MaterializedInstanceTimes[];
}

/**
 * Decides whether one reservation is reachable, and if not, whether a single
 * instance can claim it.
 *
 * Returns `null` when the reservation is reachable, which is the common case.
 */
export function classifyReservation(
  reservation: ReservationToCheck,
  day: RideDayInstances
): OrphanClassification | null {
  const matched = day.instances.some(
    (instance) => instance.departureTime === reservation.rideDepartureTime
  );

  if (matched) {
    return null;
  }

  const none = { targetDepartureTime: null, targetArrivalTime: null };

  if (!day.rideIsActive) {
    return { reason: 'RIDE_NOT_ACTIVE', ...none };
  }

  if (day.instances.length === 0) {
    return { reason: 'NO_INSTANCE', ...none };
  }

  // More than one instance is a genuine ambiguity: an ADDITIONAL exception
  // alongside the base run means two departures, and the stored time matches
  // neither. Guessing would move a passenger onto the wrong bus.
  if (day.instances.length > 1) {
    return { reason: 'AMBIGUOUS_INSTANCE', ...none };
  }

  const target = day.instances[0];

  return {
    reason: 'DEPARTURE_TIME_MOVED',
    targetDepartureTime: target.departureTime,
    targetArrivalTime: target.arrivalTime
  };
}

/**
 * Picks the seat a reservation keeps once it is moved onto the target instance.
 *
 * The seat it holds today was reserved against a departure time nobody can see,
 * so it was free as far as the app was concerned and may have been sold again.
 * Keeping the original number wherever it is still free means most passengers
 * are unaffected; the rest take the lowest free seat, which the report names so
 * the agency can tell them.
 *
 * Returns `null` when the target instance is genuinely full.
 */
export function resolveSeatNumber(
  preferredSeat: number,
  occupiedSeats: ReadonlySet<number>,
  capacity: number
): number | null {
  if (preferredSeat <= capacity && !occupiedSeats.has(preferredSeat)) {
    return preferredSeat;
  }

  for (let seat = 1; seat <= capacity; seat += 1) {
    if (!occupiedSeats.has(seat)) {
      return seat;
    }
  }

  return null;
}

/**
 * Reports reservation stations that are no longer anywhere on their ride's
 * route. Unlike a moved departure time this does not hide the reservation, but
 * it does make it unsavable — every edit re-validates the segment — so it is
 * worth naming in the same report.
 */
export function findOffRouteStationIds(
  reservation: ReservationToCheck,
  routeStationIds: ReadonlySet<string>
): string[] {
  return [reservation.departureStationId, reservation.arrivalStationId].filter(
    (stationId) => !routeStationIds.has(stationId)
  );
}
