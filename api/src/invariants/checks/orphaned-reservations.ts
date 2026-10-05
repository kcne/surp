import { DepartureSource } from '@prisma/client';
import { BaseInstanceOutcome } from '../../rides/ride-instance-materialization';

/**
 * Why an active reservation sits on a bus that is not going (#27).
 *
 * Every reservation is on a stored departure, so the question is whether that
 * departure runs. When the timetable dropped it, the ride's own schedule
 * names why.
 */

export type OrphanReason =
  /** The ride itself is DRAFT or INACTIVE, so it materializes nowhere. */
  | 'RIDE_NOT_ACTIVE'
  /** The travel date falls outside the period the ride runs in. */
  | 'DATE_OUTSIDE_RANGE'
  /** The ride no longer carries a schedule for that day of the week. */
  | 'WEEKDAY_NOT_SCHEDULED'
  /** The day is scheduled, but its first or last station has no time entered. */
  | 'SCHEDULE_TIME_MISSING'
  /** Somebody cancelled the departure the reservation is on. */
  | 'DEPARTURE_CANCELLED'
  /** The timetable no longer produces the departure, for no reason named above. */
  | 'DEPARTURE_DROPPED';

/**
 * What each reason asks the agency to do about it.
 *
 * The text lives here rather than in the settings page because the same check
 * runs in four places — before a write, nightly, on demand and in CI — and a
 * second copy of these sentences in the web app would be a copy that drifts.
 * Serbian, because an agency employee reads it.
 */
export const ORPHAN_REASON_LABELS: Record<OrphanReason, string> = {
  RIDE_NOT_ACTIVE: 'Voznja nije aktivna',
  DATE_OUTSIDE_RANGE: 'Datum je van perioda voznje',
  WEEKDAY_NOT_SCHEDULED: 'Taj dan u nedelji nije u rasporedu',
  SCHEDULE_TIME_MISSING: 'Prva ili poslednja stanica nema vreme',
  DEPARTURE_CANCELLED: 'Polazak je otkazan',
  DEPARTURE_DROPPED: 'Polazak vise nije u redu voznje'
};

export const ORPHAN_REASON_ADVICE: Record<OrphanReason, string> = {
  RIDE_NOT_ACTIVE:
    'Voznja je u statusu Nacrt ili Neaktivna, pa se ne prikazuje nigde. Vratite je u Aktivna, pa ponovite proveru.',
  DATE_OUTSIDE_RANGE:
    'Datum putovanja je van perioda u kojem voznja saobraca. Produzite period u Voznjama ili prebacite putnika na drugi datum, pa ponovite proveru.',
  WEEKDAY_NOT_SCHEDULED:
    'Voznja vise nema raspored za taj dan u nedelji. Vratite taj dan u raspored ili prebacite putnika na dan kada voznja saobraca, pa ponovite proveru.',
  SCHEDULE_TIME_MISSING:
    'Tog dana prva ili poslednja stanica nema upisano vreme, pa polazak ne moze da se izracuna. Upisite vremena u rasporedu voznje, pa ponovite proveru.',
  DEPARTURE_CANCELLED:
    'Polazak na kojem je putnik je otkazan, a rezervacija je i dalje aktivna. Ako polazak ipak saobraca, vratite ga; ako ne saobraca, javite putniku i otkazite ili prebacite rezervaciju.',
  DEPARTURE_DROPPED:
    'Red voznje vise ne pravi polazak na kojem je putnik, a rezervacija je i dalje aktivna. Proverite liniju i voznju: ako polazak treba da saobraca, vratite ga u red voznje; ako ne treba, javite putniku i otkazite ili prebacite rezervaciju.'
};

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
}

export interface RideDayInstances {
  rideIsActive: boolean;
  /** What the ride's own schedule says about the date, before exceptions. */
  baseInstance: BaseInstanceOutcome;
}

/**
 * Whether a reservation is reachable (#27, PR 3b).
 *
 * Its seat is held on its departure, and the sync keeps the time copies in
 * step with it, so the times are not the question: the departure either runs
 * or it does not. Nothing here is repairable by moving a time: the passenger
 * is on the right bus, and the bus is not going.
 *
 * Returns `null` when the departure runs, which is the common case.
 */
export function classifyLinkedReservation(
  departure: { source: DepartureSource; cancelledAt: Date | null; timetableDroppedAt: Date | null },
  day: RideDayInstances
): OrphanClassification | null {
  if (departure.cancelledAt) {
    return { reason: 'DEPARTURE_CANCELLED' };
  }

  if (!departure.timetableDroppedAt) {
    return null;
  }

  if (!day.rideIsActive) {
    return { reason: 'RIDE_NOT_ACTIVE' };
  }

  // An extra bus runs on dates the schedule does not, so the schedule's gaps
  // say nothing about why one was dropped.
  if (departure.source !== DepartureSource.EXTRA && !day.baseInstance.runs) {
    return { reason: day.baseInstance.gap };
  }

  // A deactivated line, most likely.
  return { reason: 'DEPARTURE_DROPPED' };
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
