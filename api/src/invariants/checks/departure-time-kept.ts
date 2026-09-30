import { formatDateOnly } from '../../rides/ride-instance-materialization';
import { serbianPlural } from '../serbian-plural';
import { CheckResult, InvariantContext, ProspectiveInvariant } from '../invariant.types';
import { loadReservationWindow } from './reservation-window';

/**
 * Asks before an edit moves the time of a departure somebody is booked on
 * (#27, PR 3b).
 *
 * Since bookings are counted on `departureId`, a new first-stop time strands
 * nobody: the sync moves the reservations' time copies with their bus, and
 * `reservation.reachable` no longer sees a thing. The passengers were still
 * told the old time, so the edit is refused until someone confirms it, and
 * confirming repairs nothing. The departure and arrival times both count.
 *
 * A prospective check only, never registered for reports. What it lists is
 * not wrong on its own: every booked departure's times, one entry per active
 * reservation, keyed on the times as well as the reservation. The guard's
 * before-and-after comparison then reports exactly the reservations whose
 * bus the edit moved, and binds the confirmation to them.
 */
export const reservationDepartureTimeKept: ProspectiveInvariant = {
  key: 'reservation.departureTimeKept',
  title: 'Vreme polaska se ne menja putnicima',
  description:
    'Rezervacija ostaje na svom autobusu i kada mu se promeni vreme, ali putnik zna samo vreme koje mu je receno pri kupovini.',
  manualAdvice: 'Javite putnicima novo vreme polaska i dolaska.',
  severity: 'warning',

  breakingChangeMessage: (count) =>
    `Ova izmena menja vreme polaska ili dolaska za ${serbianPlural(count, 'rezervaciju', 'rezervacije', 'rezervacija')}. Putnici ostaju na istom polasku, ali im treba javiti novo vreme.`,

  async check(ctx: InvariantContext): Promise<CheckResult> {
    const window = await loadReservationWindow(ctx);
    const violations: CheckResult['violations'] = [];

    for (const reservation of window.reservations) {
      const departure = window.departureOf(reservation);

      if (!departure) {
        continue;
      }

      const times = `${departure.departureTime}-${departure.arrivalTime}`;

      violations.push({
        subjectType: 'reservation',
        subjectId: `${reservation.id}@${times}`,
        summary: `${reservation.passenger.firstName} ${reservation.passenger.lastName}, ${formatDateOnly(reservation.travelDate)}: polazak ${departure.departureTime}, dolazak ${departure.arrivalTime}.`,
        detail: {
          reservationId: reservation.id,
          departureId: departure.id,
          departureTime: departure.departureTime,
          arrivalTime: departure.arrivalTime
        },
        canRepair: false
      });
    }

    return { violations, scannedCount: window.reservations.length };
  }
};
