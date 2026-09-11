import { Invariant } from './invariant.types';
import { pairedDirectionsAgree } from './checks/paired-directions-agree';
import { reservationReachable } from './checks/reservation-reachable';
import { scheduleMatchesRoute } from './checks/schedule-matches-route';
import { terminiReachable } from './checks/termini-reachable';

/**
 * Every invariant the system knows about.
 *
 * Ordered by what an agency would want to see first: passengers who cannot be
 * seen, then the route problems that cause them.
 *
 * Adding a check is one file and one line here — that is the whole point of the
 * registry. Each of the four below arrived as its own endpoint, its own DTO and
 * its own settings card, which is why the fifth needed this instead.
 */
export const INVARIANTS: readonly Invariant[] = [
  reservationReachable,
  scheduleMatchesRoute,
  pairedDirectionsAgree,
  terminiReachable
];

export function findInvariant(key: string): Invariant | undefined {
  return INVARIANTS.find((invariant) => invariant.key === key);
}
