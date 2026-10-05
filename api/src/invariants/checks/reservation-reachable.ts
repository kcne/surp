import { formatDateOnly } from '../../rides/ride-instance-materialization';
import {
  ORPHAN_REASON_ADVICE,
  ORPHAN_REASON_LABELS,
  classifyLinkedReservation,
  findOffRouteStationIds,
  type OrphanReason
} from './orphaned-reservations';
import { loadReservationWindow } from './reservation-window';
import { CheckResult, InvariantContext, ProspectiveInvariant } from '../invariant.types';
import { loadStationNames } from './tenant-lookups';
import { serbianPlural } from '../serbian-plural';

/**
 * Every active reservation is on a departure that runs.
 *
 * Since #27 PR 3b a reservation is judged by its stored departure: the sync
 * keeps its time copies in step, so it is reachable while the bus runs, and
 * listed once the bus is cancelled or dropped from the timetable. Since PR 5
 * every reservation has a departure, so there is no time left to repair: the
 * passenger is on the right bus, and the bus is not going.
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
  seatNumber: number;
  reason: OrphanReason;
  reasonLabel: string;
  reasonAdvice: string;
  offRouteStationNames: string[];
}

export interface OrphanReport {
  windowStartDate: string;
  windowEndDate: string;
  scannedReservationCount: number;
  items: OrphanedReservationItem[];
}

/** Walks every active reservation travelling inside the window. */
export async function buildOrphanReport(ctx: InvariantContext): Promise<OrphanReport> {
  const window = await loadReservationWindow(ctx);
  const items: OrphanedReservationItem[] = [];

  if (window.reservations.length === 0) {
    return {
      windowStartDate: window.windowStartDate,
      windowEndDate: window.windowEndDate,
      scannedReservationCount: 0,
      items
    };
  }

  const stationNameById = await loadStationNames(ctx);
  const stationName = (stationId: string) => stationNameById.get(stationId) ?? stationId;

  for (const reservation of window.reservations) {
    const travelDate = formatDateOnly(reservation.travelDate)!;
    const ride = window.rideOf(reservation);

    if (!ride) {
      continue;
    }

    const classification = classifyLinkedReservation(
      window.departureOf(reservation),
      window.dayOf(ride, travelDate)
    );

    if (!classification) {
      continue;
    }

    const route = window.routeOf(reservation, ride);
    const routeStationIds = new Set<string>([
      route.departureStationId,
      route.arrivalStationId,
      ...route.intermediateStops.map((stop) => stop.stationId)
    ]);

    items.push({
      reservationId: reservation.id,
      passengerName: `${reservation.passenger.firstName} ${reservation.passenger.lastName}`,
      passengerPhone: reservation.passenger.phone,
      travelDate,
      rideName: ride.name,
      lineName: ride.line.name,
      departureStationName: stationName(reservation.departureStationId),
      arrivalStationName: stationName(reservation.arrivalStationId),
      currentDepartureTime: reservation.rideDepartureTime,
      seatNumber: reservation.seatNumber,
      reason: classification.reason,
      reasonLabel: ORPHAN_REASON_LABELS[classification.reason],
      reasonAdvice: ORPHAN_REASON_ADVICE[classification.reason],
      offRouteStationNames: findOffRouteStationIds(
        { ...reservation, travelDate },
        routeStationIds
      ).map(stationName)
    });
  }

  return {
    windowStartDate: window.windowStartDate,
    windowEndDate: window.windowEndDate,
    scannedReservationCount: window.reservations.length,
    items
  };
}

export const reservationReachable: ProspectiveInvariant = {
  key: 'reservation.reachable',
  title: 'Rezervacija se vidi na svom polasku',
  description:
    'Svaka aktivna rezervacija je na jednom polasku. Kada se taj polazak otkaže ili ga red vožnje više ne pravi, rezervacija ostaje aktivna i drži sedište na autobusu koji ne ide.',
  manualAdvice:
    'Za svakog putnika sa spiska: ako polazak ipak treba da ide, vratite ga; ako ne ide, javite putniku i otkažite ili prebacite rezervaciju.',
  severity: 'critical',

  breakingChangeMessage: (count) =>
    `Ova izmena cini ${serbianPlural(count, 'rezervaciju nevidljivom', 'rezervacije nevidljivim', 'rezervacija nevidljivim')}.`,

  async check(ctx: InvariantContext): Promise<CheckResult> {
    const report = await buildOrphanReport(ctx);

    return {
      scannedCount: report.scannedReservationCount,
      violations: report.items.map((item) => ({
        subjectType: 'reservation' as const,
        subjectId: item.reservationId,
        summary: `${item.passengerName}, ${item.travelDate}, polazak ${item.currentDepartureTime}: ${item.reasonLabel.toLowerCase()}.`,
        detail: { ...item },
        canRepair: false
      }))
    };
  }
};
