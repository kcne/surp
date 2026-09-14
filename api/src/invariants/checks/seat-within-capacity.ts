import { CheckResult, Invariant, InvariantContext } from '../invariant.types';
import { loadInstanceOccupancy } from './seat-occupancy';

/**
 * No passenger holds a seat number the bus does not have.
 *
 * Capacity is written straight through on `PUT /rides/:id` with nothing asked
 * about the reservations already sold against it. Lowering a ride from 48 seats
 * to 30 leaves every passenger from seat 31 up holding a seat that no longer
 * exists — the reservation stays visible, the seat number is printed on the
 * list, and nobody finds out until the passenger is standing at the door.
 *
 * The write itself now refuses to lower capacity under an occupied seat without
 * an explicit confirmation, so new cases have to be deliberate. This check is
 * what finds the ones written before that guard existed, and the ones a
 * confirmed lowering left behind on purpose.
 *
 * Reported, never repaired. Two very different fixes are reasonable — put the
 * capacity back, or move the passenger to a free seat — and only the agency
 * knows which bus is actually running.
 */

export interface SeatOverCapacityItem {
  reservationId: string;
  passengerName: string;
  passengerPhone: string;
  rideName: string;
  lineName: string;
  travelDate: string;
  departureTime: string;
  seatNumber: number;
  capacity: number;
}

export async function findSeatsOverCapacity(
  ctx: InvariantContext
): Promise<{ items: SeatOverCapacityItem[]; scannedReservationCount: number }> {
  const scan = await loadInstanceOccupancy(ctx);
  const items: SeatOverCapacityItem[] = [];

  for (const instance of scan.instances) {
    for (const seat of instance.seats) {
      if (seat.seatNumber <= instance.capacity) {
        continue;
      }

      items.push({
        reservationId: seat.reservationId,
        passengerName: seat.passengerName,
        passengerPhone: seat.passengerPhone,
        rideName: instance.rideName,
        lineName: instance.lineName,
        travelDate: instance.travelDate,
        departureTime: instance.departureTime,
        seatNumber: seat.seatNumber,
        capacity: instance.capacity
      });
    }
  }

  return { items, scannedReservationCount: scan.scannedReservationCount };
}

export const reservationSeatWithinCapacity: Invariant = {
  key: 'reservation.seatWithinCapacity',
  title: 'Sediste postoji u autobusu',
  description:
    'Kapacitet voznje se moze smanjiti i posle prodaje. Kada se smanji ispod vec prodatog sedista, putnik i dalje vidi svoj broj sedista i dolazi na polazak, a tog sedista u autobusu nema.',
  severity: 'critical',

  async check(ctx: InvariantContext): Promise<CheckResult> {
    const { items, scannedReservationCount } = await findSeatsOverCapacity(ctx);

    return {
      scannedCount: scannedReservationCount,
      violations: items.map((item) => ({
        subjectType: 'reservation' as const,
        subjectId: item.reservationId,
        summary: `${item.passengerName}, ${item.travelDate}, polazak ${item.departureTime}: sediste ${item.seatNumber}, a voznja ima ${item.capacity} mesta.`,
        detail: { ...item },
        canRepair: false
      }))
    };
  }

  // No repair: raising the capacity back and moving the passenger are both
  // reasonable, and only the agency knows which bus is running that day.
};
