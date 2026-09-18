import { formatDateOnly } from '../../rides/ride-instance-materialization';
import { CheckResult, Invariant, InvariantContext } from '../invariant.types';
import { loadReservationWindow } from './reservation-window';

/**
 * No active, future reservation belongs to a deactivated passenger.
 *
 * `passengers.service.ts` writes `isActive` on a passenger with no check on
 * what that passenger already holds. A passenger deactivated for being a
 * duplicate, or blocked, or simply retired from the system, can still be
 * standing at the door with a reservation the agency's own records say
 * should not exist for them.
 *
 * Reported, never repaired. Whether the reservation should be cancelled or
 * the passenger reactivated is the same call the agency made when it
 * deactivated them in the first place.
 */

export interface InactivePassengerReservationItem {
  reservationId: string;
  passengerId: string;
  passengerName: string;
  passengerPhone: string;
  travelDate: string;
  rideName: string;
  lineName: string;
  departureTime: string;
}

export async function findReservationsWithInactivePassenger(
  ctx: InvariantContext
): Promise<{ items: InactivePassengerReservationItem[]; scannedReservationCount: number }> {
  const window = await loadReservationWindow(ctx);
  const items: InactivePassengerReservationItem[] = [];

  for (const reservation of window.reservations) {
    if (reservation.passenger.isActive) {
      continue;
    }

    const ride = window.rideOf(reservation);

    if (!ride) {
      continue;
    }

    items.push({
      reservationId: reservation.id,
      passengerId: reservation.passenger.id,
      passengerName: `${reservation.passenger.firstName} ${reservation.passenger.lastName}`,
      passengerPhone: reservation.passenger.phone,
      travelDate: formatDateOnly(reservation.travelDate)!,
      rideName: ride.name,
      lineName: ride.line.name,
      departureTime: reservation.rideDepartureTime
    });
  }

  return { items, scannedReservationCount: window.reservations.length };
}

export const reservationPassengerActive: Invariant = {
  key: 'reservation.passengerActive',
  title: 'Putnik rezervacije je aktivan',
  description:
    'Deaktiviranje putnika ne proverava da li putnik ima aktivnu buducu rezervaciju. Deaktivirani putnik moze i dalje da se pojavi na polasku sa vazecom kartom.',
  manualAdvice:
    'Odlucite sta je tacno: ako putnik i dalje putuje, vratite ga medju aktivne; ako ne putuje, otkazite njegove buduce rezervacije. Dok je ovako, putnik sa vazecom kartom se ne vidi tamo gde ga ocekujete.',
  severity: 'critical',

  async check(ctx: InvariantContext): Promise<CheckResult> {
    const { items, scannedReservationCount } = await findReservationsWithInactivePassenger(ctx);

    return {
      scannedCount: scannedReservationCount,
      violations: items.map((item) => ({
        subjectType: 'reservation' as const,
        subjectId: item.reservationId,
        summary: `${item.passengerName}, ${item.travelDate}, polazak ${item.departureTime}: putnik je deaktiviran.`,
        detail: { ...item },
        canRepair: false
      }))
    };
  }

  // No repair: cancelling the reservation and reactivating the passenger are
  // both reasonable, and only the agency knows which one matches intent.
};
