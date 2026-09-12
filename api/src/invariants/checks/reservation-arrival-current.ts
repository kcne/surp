import { withUpdateAudit } from '../../prisma/audit-write.helper';
import { formatDateOnly } from '../../rides/ride-instance-materialization';
import { CheckResult, Invariant, InvariantContext, RepairResult } from '../invariant.types';
import { loadReservationWindow } from './reservation-window';

/**
 * A reservation stores the arrival time of the departure it sits on, and that
 * copy is what the passenger is told and what the printed list carries.
 *
 * Changing the *first* station's time hides the reservation, which
 * `reservation.reachable` reports loudly. Changing the *last* station's time
 * does nothing of the sort: the reservation stays visible on the right
 * departure, and only the arrival it quotes is wrong. Nobody has ever reported
 * this, because from the inside nothing is broken — the passenger simply turns
 * up expecting a bus at the wrong hour.
 *
 * Unlike every other repair in the registry, this one needs no decision:
 * the stored value is a display copy of a time that is derived elsewhere, and
 * refreshing it moves nobody's seat and cancels nobody's trip.
 */

export interface StaleArrivalItem {
  reservationId: string;
  passengerName: string;
  passengerPhone: string;
  travelDate: string;
  rideName: string;
  departureTime: string;
  storedArrivalTime: string;
  currentArrivalTime: string;
}

export async function scanForStaleArrivalTimes(ctx: InvariantContext): Promise<{
  scannedCount: number;
  items: StaleArrivalItem[];
}> {
  const window = await loadReservationWindow(ctx);
  const items: StaleArrivalItem[] = [];

  for (const reservation of window.reservations) {
    const travelDate = formatDateOnly(reservation.travelDate)!;
    const ride = window.rideOf(reservation);

    if (!ride) {
      continue;
    }

    const day = window.dayOf(ride, travelDate);
    const instance = day.instances.find(
      (candidate) => candidate.departureTime === reservation.rideDepartureTime
    );

    // A reservation no instance reaches is unreachable, which is a different
    // invariant's finding. Reporting it here too would double-count the same
    // passenger under a heading that understates the problem.
    if (!instance || instance.arrivalTime === reservation.rideArrivalTime) {
      continue;
    }

    items.push({
      reservationId: reservation.id,
      passengerName: `${reservation.passenger.firstName} ${reservation.passenger.lastName}`,
      passengerPhone: reservation.passenger.phone,
      travelDate,
      rideName: ride.name,
      departureTime: reservation.rideDepartureTime,
      storedArrivalTime: reservation.rideArrivalTime,
      currentArrivalTime: instance.arrivalTime
    });
  }

  return { scannedCount: window.reservations.length, items };
}

export const reservationArrivalCurrent: Invariant = {
  key: 'reservation.arrivalTimeCurrent',
  title: 'Rezervacija nosi tacno vreme dolaska',
  description:
    'Rezervacija cuva vreme dolaska polaska na kojem se nalazi, i to je vreme koje putnik dobija i koje stoji na spisku. Kada se promeni vreme poslednje stanice, rezervacija ostaje vidljiva na svom polasku, ali nosi staro vreme dolaska — nista ne puca, putnik samo dobije pogresan sat.',
  severity: 'warning',

  async check(ctx: InvariantContext): Promise<CheckResult> {
    const scan = await scanForStaleArrivalTimes(ctx);

    return {
      scannedCount: scan.scannedCount,
      violations: scan.items.map((item) => ({
        subjectType: 'reservation' as const,
        subjectId: item.reservationId,
        summary: `${item.passengerName}, ${item.travelDate}: dolazak ${item.storedArrivalTime} umesto ${item.currentArrivalTime}.`,
        detail: { ...item },
        canRepair: true
      }))
    };
  },

  /**
   * Rewrites the stored copy from the schedule it was copied from.
   *
   * The scan is re-run rather than trusting a report the caller loaded minutes
   * ago, so what is written is the arrival time the ride carries right now.
   */
  async repair(ctx: InvariantContext): Promise<RepairResult> {
    const scan = await scanForStaleArrivalTimes(ctx);

    let repairedCount = 0;

    for (const item of scan.items) {
      await ctx.prisma.reservation.update({
        where: { id: item.reservationId },
        data: withUpdateAudit({ rideArrivalTime: item.currentArrivalTime }, ctx.actorId)
      });

      repairedCount += 1;
    }

    return { repairedCount, skippedCount: 0 };
  }
};
