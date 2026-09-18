import { formatDateOnly } from '../../rides/ride-instance-materialization';
import { routeBoardingDropoffSets, routeStationOrder } from '../../reservations/route-segment';
import { CheckResult, InvariantContext, ProspectiveInvariant } from '../invariant.types';
import { loadReservationWindow } from './reservation-window';
import { loadStationNames, stationNamer } from './tenant-lookups';
import { serbianPlural } from '../serbian-plural';

/**
 * A reservation's segment reads the same way `validateAndResolveSegment`
 * requires at booking time: departure comes before arrival in the current
 * route order, the departure station is a boarding stop, and the arrival
 * station is a drop-off stop.
 *
 * `isBoarding`/`isDropoff` are ordinary fields on a line stop, free to flip
 * after tickets are sold, and nothing re-checks a reservation against them
 * once it exists. Flip a stop from boarding to drop-off-only and every
 * reservation booked to depart from it is now a reservation that would be
 * rejected today, sitting there active. This is the one check in the
 * registry that was entirely uncovered before it existed.
 *
 * A reservation whose station is missing from the route entirely is
 * `reservation.stationsOnRoute`'s finding, not this one: order and role
 * cannot be judged for a station this route no longer has.
 *
 * Reported, never repaired. Moving the departure or arrival to a different
 * stop is a decision about where the passenger actually gets on or off, and
 * only the agency knows the answer.
 */

export interface InvalidSegmentItem {
  reservationId: string;
  passengerName: string;
  passengerPhone: string;
  travelDate: string;
  rideName: string;
  lineName: string;
  departureTime: string;
  departureStationName: string;
  arrivalStationName: string;
  orderReversed: boolean;
  departureNotBoarding: boolean;
  arrivalNotDropoff: boolean;
}

interface RouteShape {
  stationOrderById: Map<string, number>;
  boardingStationIds: Set<string>;
  dropoffStationIds: Set<string>;
}

export async function findInvalidSegments(ctx: InvariantContext): Promise<{
  items: InvalidSegmentItem[];
  scannedReservationCount: number;
}> {
  const window = await loadReservationWindow(ctx);
  const toName = stationNamer(await loadStationNames(ctx));
  const items: InvalidSegmentItem[] = [];
  // One numbering per ride rather than per reservation, matching the seat
  // checks: the route behind a ride does not change mid-scan.
  const routeByRideId = new Map<string, RouteShape>();

  for (const reservation of window.reservations) {
    const ride = window.rideOf(reservation);

    if (!ride) {
      continue;
    }

    const route =
      routeByRideId.get(ride.id) ??
      routeByRideId
        .set(ride.id, {
          stationOrderById: routeStationOrder(ride.line),
          ...routeBoardingDropoffSets(ride.line)
        })
        .get(ride.id)!;

    const departureOrder = route.stationOrderById.get(reservation.departureStationId);
    const arrivalOrder = route.stationOrderById.get(reservation.arrivalStationId);

    if (departureOrder === undefined || arrivalOrder === undefined) {
      continue;
    }

    const orderReversed = departureOrder >= arrivalOrder;
    const departureNotBoarding = !route.boardingStationIds.has(reservation.departureStationId);
    const arrivalNotDropoff = !route.dropoffStationIds.has(reservation.arrivalStationId);

    if (!orderReversed && !departureNotBoarding && !arrivalNotDropoff) {
      continue;
    }

    items.push({
      reservationId: reservation.id,
      passengerName: `${reservation.passenger.firstName} ${reservation.passenger.lastName}`,
      passengerPhone: reservation.passenger.phone,
      travelDate: formatDateOnly(reservation.travelDate)!,
      rideName: ride.name,
      lineName: ride.line.name,
      departureTime: reservation.rideDepartureTime,
      departureStationName: toName(reservation.departureStationId),
      arrivalStationName: toName(reservation.arrivalStationId),
      orderReversed,
      departureNotBoarding,
      arrivalNotDropoff
    });
  }

  return { items, scannedReservationCount: window.reservations.length };
}

function describeProblems(item: InvalidSegmentItem): string {
  const problems: string[] = [];

  if (item.orderReversed) {
    problems.push('dolazak nije posle polaska na ruti');
  }

  if (item.departureNotBoarding) {
    problems.push(`${item.departureStationName} vise nije stanica za ukrcavanje`);
  }

  if (item.arrivalNotDropoff) {
    problems.push(`${item.arrivalStationName} vise nije stanica za iskrcavanje`);
  }

  return problems.join('; ');
}

export const reservationSegmentValid: ProspectiveInvariant = {
  key: 'reservation.segmentValid',
  title: 'Deonica rezervacije je i dalje ispravna',
  description:
    'Polazna stanica mora biti pre dolazne na ruti, polazna mora biti stanica za ukrcavanje, a dolazna stanica za iskrcavanje. Ovo se proverava samo pri upisu; ako se ove osobine stanice promene posle prodaje karte, rezervacija ostaje aktivna iako bi danas bila odbijena.',
  manualAdvice:
    'Otvorite rezervaciju i ispravite stanice prema danasnjoj ruti: polazna mora biti pre dolazne, sa polazne se sme ukrcati, a na dolaznoj iskrcati. Ako je stanica greskom oznacena da nema ukrcavanje ili iskrcavanje, ispravite to na liniji.',
  severity: 'critical',

  breakingChangeMessage: (count) =>
    `Ova izmena kvari deonicu za ${serbianPlural(count, 'rezervaciju', 'rezervacije', 'rezervacija')}.`,

  async check(ctx: InvariantContext): Promise<CheckResult> {
    const { items, scannedReservationCount } = await findInvalidSegments(ctx);

    return {
      scannedCount: scannedReservationCount,
      violations: items.map((item) => ({
        subjectType: 'reservation' as const,
        subjectId: item.reservationId,
        summary: `${item.passengerName}, ${item.travelDate}, polazak ${item.departureTime}: ${describeProblems(item)}.`,
        detail: { ...item },
        canRepair: false
      }))
    };
  }

  // No repair: moving either station to fix the order or the role is a
  // routing decision, not a fact the data can settle on its own.
};
