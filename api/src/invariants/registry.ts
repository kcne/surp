import { Invariant } from './invariant.types';
import { instanceNotOverbooked } from './checks/instance-not-overbooked';
import { pairedDirectionsAgree } from './checks/paired-directions-agree';
import { reservationPassengerActive } from './checks/passenger-active';
import { reservationGroupPresent } from './checks/group-present';
import { reservationArrivalCurrent } from './checks/reservation-arrival-current';
import { reservationReachable } from './checks/reservation-reachable';
import { rideLineActive } from './checks/ride-line-active';
import { routeStationsActive } from './checks/route-stations-active';
import { reservationSegmentValid } from './checks/segment-valid';
import { reservationSeatUnique } from './checks/seat-unique';
import { reservationSeatWithinCapacity } from './checks/seat-within-capacity';
import { scheduleMatchesRoute } from './checks/schedule-matches-route';
import { reservationStationsOnRoute } from './checks/stations-on-route';
import { terminiReachable } from './checks/termini-reachable';

/**
 * Every invariant the system knows about.
 *
 * Ordered by what an agency would want to see first: passengers who cannot be
 * seen or whose stored stations or segment no longer match the route, then
 * passengers who will turn up to a seat that is taken or missing, then the
 * route and schedule problems that cause all of the above.
 *
 * Adding a check is one file and one line here — that is the whole point of the
 * registry. The first four arrived as their own endpoint, their own DTO and
 * their own settings card, which is why the fifth needed this instead.
 */
export const INVARIANTS: readonly Invariant[] = [
  reservationReachable,
  reservationArrivalCurrent,
  reservationStationsOnRoute,
  reservationSegmentValid,
  reservationPassengerActive,
  reservationGroupPresent,
  reservationSeatUnique,
  reservationSeatWithinCapacity,
  instanceNotOverbooked,
  scheduleMatchesRoute,
  pairedDirectionsAgree,
  terminiReachable,
  routeStationsActive,
  rideLineActive
];

export function findInvariant(key: string): Invariant | undefined {
  return INVARIANTS.find((invariant) => invariant.key === key);
}
