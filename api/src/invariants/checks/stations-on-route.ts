import { formatDateOnly } from '../../rides/ride-instance-materialization';
import { CheckResult, Invariant, InvariantContext } from '../invariant.types';
import { findOffRouteStationIds } from './orphaned-reservations';
import { loadReservationWindow } from './reservation-window';
import { loadStationNames, stationNamer } from './tenant-lookups';

/**
 * Both stations a reservation names are still somewhere on its line's route.
 *
 * `validateAndResolveSegment` requires this on every write, but a route edit
 * after the sale is enough to break it: removing a station, or moving it to a
 * different line, leaves the reservation's stored id pointing at nothing the
 * current route recognizes. That reservation is unsavable — any edit
 * re-validates the segment and fails — yet it can still be perfectly
 * reachable through its ride instance, so `reservation.reachable` never sees
 * it. This is the same condition `offRouteStationNames` already surfaces
 * inside that report; it earns a check of its own because it is a distinct
 * failure with a distinct fix (fix the route, or the reservation's stations),
 * not a symptom of a reservation nobody can find.
 *
 * Reported, never repaired. Whether the station was removed by mistake or the
 * reservation should move to a different stop is a routing decision only the
 * agency can make.
 */

export interface OffRouteReservationItem {
  reservationId: string;
  passengerName: string;
  passengerPhone: string;
  travelDate: string;
  rideName: string;
  lineName: string;
  departureTime: string;
  offRouteStationNames: string[];
}

export async function findReservationsOffRoute(ctx: InvariantContext): Promise<{
  items: OffRouteReservationItem[];
  scannedReservationCount: number;
}> {
  const window = await loadReservationWindow(ctx);
  const toName = stationNamer(await loadStationNames(ctx));
  const items: OffRouteReservationItem[] = [];

  for (const reservation of window.reservations) {
    const ride = window.rideOf(reservation);

    if (!ride) {
      continue;
    }

    const travelDate = formatDateOnly(reservation.travelDate)!;
    const routeStationIds = new Set<string>([
      ride.line.departureStationId,
      ride.line.arrivalStationId,
      ...ride.line.intermediateStops.map((stop) => stop.stationId)
    ]);

    const offRouteStationIds = findOffRouteStationIds(
      { ...reservation, travelDate },
      routeStationIds
    );

    if (offRouteStationIds.length === 0) {
      continue;
    }

    items.push({
      reservationId: reservation.id,
      passengerName: `${reservation.passenger.firstName} ${reservation.passenger.lastName}`,
      passengerPhone: reservation.passenger.phone,
      travelDate,
      rideName: ride.name,
      lineName: ride.line.name,
      departureTime: reservation.rideDepartureTime,
      offRouteStationNames: offRouteStationIds.map(toName)
    });
  }

  return { items, scannedReservationCount: window.reservations.length };
}

export const reservationStationsOnRoute: Invariant = {
  key: 'reservation.stationsOnRoute',
  title: 'Stanice rezervacije su na ruti',
  description:
    'Rezervacija cuva dve stanice, a njihov redosled i ulogu odredjuje trenutna ruta linije pri svakom citanju. Kada se stanica ukloni sa linije ili linija promeni rutu, rezervacija ostaje u bazi, ali vise ne moze pouzdano da se prikaze ni izmeni.',
  manualAdvice:
    'Ako je stanica uklonjena sa rute greskom, vratite je na liniju. U suprotnom otvorite rezervaciju i prepisite je na stanice koje su danas na ruti, pa obavestite putnika o promeni.',
  severity: 'critical',

  async check(ctx: InvariantContext): Promise<CheckResult> {
    const { items, scannedReservationCount } = await findReservationsOffRoute(ctx);

    return {
      scannedCount: scannedReservationCount,
      violations: items.map((item) => ({
        subjectType: 'reservation' as const,
        subjectId: item.reservationId,
        summary: `${item.passengerName}, ${item.travelDate}, polazak ${item.departureTime}: ${item.offRouteStationNames.join(', ')} vise nije na ruti ${item.lineName}.`,
        detail: { ...item },
        canRepair: false
      }))
    };
  }

  // No repair: fixing the route back to include the station and moving the
  // reservation to a different one are both reasonable, and only the agency
  // knows which was intended.
};
