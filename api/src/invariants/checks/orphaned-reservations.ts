import {
  BaseInstanceOutcome,
  MaterializedInstanceTimes
} from '../../rides/ride-instance-materialization';

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
  /** The ride itself is DRAFT or INACTIVE, so it materializes nowhere. */
  | 'RIDE_NOT_ACTIVE'
  /** The travel date falls outside the period the ride runs in. */
  | 'DATE_OUTSIDE_RANGE'
  /** The ride no longer carries a schedule for that day of the week. */
  | 'WEEKDAY_NOT_SCHEDULED'
  /** The day is scheduled, but its first or last station has no time entered. */
  | 'SCHEDULE_TIME_MISSING'
  /** Somebody marked the date as not running. */
  | 'SKIPPED_BY_EXCEPTION'
  /** The extra departure this reservation was booked on is gone. */
  | 'EXTRA_DEPARTURE_REMOVED';

/**
 * What each reason asks the agency to do about it.
 *
 * The text lives here rather than in the settings page because the same check
 * runs in four places — before a write, nightly, on demand and in CI — and a
 * second copy of these sentences in the web app would be a copy that drifts.
 * Serbian, because an agency employee reads it.
 */
export const ORPHAN_REASON_LABELS: Record<OrphanReason, string> = {
  DEPARTURE_TIME_MOVED: 'Vreme polaska pomereno',
  AMBIGUOUS_INSTANCE: 'Vise polazaka tog dana',
  RIDE_NOT_ACTIVE: 'Voznja nije aktivna',
  DATE_OUTSIDE_RANGE: 'Datum je van perioda voznje',
  WEEKDAY_NOT_SCHEDULED: 'Taj dan u nedelji nije u rasporedu',
  SCHEDULE_TIME_MISSING: 'Prva ili poslednja stanica nema vreme',
  SKIPPED_BY_EXCEPTION: 'Upisano je da se tog dana ne vozi',
  EXTRA_DEPARTURE_REMOVED: 'Dodatni polazak je obrisan'
};

export const ORPHAN_REASON_ADVICE: Record<OrphanReason, string> = {
  DEPARTURE_TIME_MOVED:
    'Tog dana voznja saobraca, ali u drugo vreme nego sto rezervacija nosi. Popravka prebacuje rezervaciju na taj polazak i zadrzava sediste kad je slobodno.',
  AMBIGUOUS_INSTANCE:
    'Tog dana voznja ima vise polazaka, pa se iz podataka ne vidi na koji je putnik rezervisao. Otvorite rezervaciju i izaberite polazak rucno.',
  RIDE_NOT_ACTIVE:
    'Voznja je u statusu Nacrt ili Neaktivna, pa se ne prikazuje nigde. Vratite je u Aktivna, pa ponovite proveru.',
  DATE_OUTSIDE_RANGE:
    'Datum putovanja je van perioda u kojem voznja saobraca. Produzite period u Voznjama ili prebacite putnika na drugi datum, pa ponovite proveru.',
  WEEKDAY_NOT_SCHEDULED:
    'Voznja vise nema raspored za taj dan u nedelji. Vratite taj dan u raspored ili prebacite putnika na dan kada voznja saobraca, pa ponovite proveru.',
  SCHEDULE_TIME_MISSING:
    'Tog dana prva ili poslednja stanica nema upisano vreme, pa polazak ne moze da se izracuna. Upisite vremena u rasporedu voznje, pa ponovite proveru.',
  SKIPPED_BY_EXCEPTION:
    'Za taj datum je upisan izuzetak da voznja ne saobraca. Ako ipak saobraca, obrisite izuzetak; ako ne saobraca, javite putniku i prebacite rezervaciju.',
  EXTRA_DEPARTURE_REMOVED:
    'Vreme koje rezervacija nosi ne daje raspored voznje za taj datum, pa je putnik najverovatnije rezervisao na dodatni polazak koji je obrisan. Proverite da li tog dana voznja uopste treba da saobraca: ako treba, vratite taj polazak kao izuzetak; ako ne treba, javite putniku i prebacite rezervaciju.'
};

/**
 * Advice for an orphan a repair cannot take, even though its departure is known.
 *
 * `DEPARTURE_TIME_MOVED` is the one reason whose sentence describes the repair,
 * and the repair still declines when the target departure has no free seat.
 * Showing the repair's own sentence there tells the agency a button will handle
 * something the button is refusing to handle.
 */
export const ORPHAN_NO_FREE_SEAT_ADVICE =
  'Tog dana voznja saobraca u drugo vreme, ali na tom polasku nema nijedno slobodno sediste, pa popravka ne moze da prebaci rezervaciju. Povecajte kapacitet voznje ili prebacite putnika na drugi polazak.';

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
  /** What the ride's own schedule says about the date, before exceptions. */
  baseInstance: BaseInstanceOutcome;
  /** Whether a SKIP exception marks the date as not running. */
  skippedByException: boolean;
}

/**
 * Decides whether one reservation is reachable, and if not, which of the causes
 * of unreachability it is facing.
 *
 * "No departure that day" is one symptom with several causes, and the agency
 * cannot act until it knows which: a weekday dropped from the schedule needs a
 * decision about the passenger, a missing station time needs a field filled in,
 * and a SKIP exception may simply be correct. Reporting them as one reason left
 * whoever opened the report to reconstruct the difference by hand.
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
    return { reason: emptyDayReason(reservation, day), ...none };
  }

  // More than one instance is a genuine ambiguity: an ADDITIONAL exception
  // alongside the base run means two departures, and the stored time matches
  // neither. Guessing would move a passenger onto the wrong bus.
  if (day.instances.length > 1) {
    return { reason: 'AMBIGUOUS_INSTANCE', ...none };
  }

  const target = day.instances[0];

  // A single instance at a different time is read as a moved departure, which
  // is what a route edit produces. A deleted ADDITIONAL exception on a date
  // whose base run still stands looks exactly the same from here, and only the
  // change history could tell them apart — that history is #26.
  return {
    reason: 'DEPARTURE_TIME_MOVED',
    targetDepartureTime: target.departureTime,
    targetArrivalTime: target.arrivalTime
  };
}

/**
 * Names why a date materialized nothing.
 *
 * The ride's own schedule is asked first: when it does not run that date at
 * all, that is the cause, and a SKIP sitting on top of a date that was never
 * going to run says nothing useful. Only once the base run does stand is the
 * SKIP what removed it.
 */
function emptyDayReason(reservation: ReservationToCheck, day: RideDayInstances): OrphanReason {
  if (!day.baseInstance.runs) {
    return day.baseInstance.gap;
  }

  if (!day.skippedByException) {
    // The base run stands and nothing suppressed it, so the day is not empty
    // and this branch is unreachable. Naming the skip is still the honest
    // answer if the two ever disagree.
    return 'SKIPPED_BY_EXCEPTION';
  }

  // A SKIP paired with an ADDITIONAL is how an agency moves a single day to a
  // different time. Delete the ADDITIONAL and the day empties out, leaving
  // reservations holding a departure time the base schedule never produced —
  // which is what separates this from a day that was simply cancelled.
  //
  // The separation is a reading of the stored time, not a fact: a route edit
  // moves the base departure time on every date of the line, so a reservation
  // booked before that edit also fails to match it, and a SKIP on the same date
  // lands it here. The advice is worded to be acted on either way until the
  // change history of #26 can tell them apart.
  return reservation.rideDepartureTime === day.baseInstance.departureTime
    ? 'SKIPPED_BY_EXCEPTION'
    : 'EXTRA_DEPARTURE_REMOVED';
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
