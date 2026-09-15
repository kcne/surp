import { formatDateOnly } from '../../rides/ride-instance-materialization';
import { CheckResult, Invariant, InvariantContext } from '../invariant.types';

export interface ReservationWithoutGroupItem {
  reservationId: string;
  passengerId: string;
  passengerName: string;
  rideId: string;
  rideName: string;
  travelDate: string;
  departureTime: string;
  seatNumber: number;
}

/**
 * Finds legacy or incorrectly-created reservations that cannot receive a
 * driver-facing G1/G2/... label. Unlike the time-windowed operational checks,
 * this scans every status and date because the database invariant applies to
 * every reservation row, including history.
 */
export async function findReservationsWithoutGroup(
  ctx: InvariantContext
): Promise<{ items: ReservationWithoutGroupItem[]; scannedReservationCount: number }> {
  const [scannedReservationCount, reservations] = await Promise.all([
    ctx.prisma.reservation.count({ where: { tenantId: ctx.tenantId } }),
    ctx.prisma.reservation.findMany({
      where: { tenantId: ctx.tenantId, groupId: null },
      select: {
        id: true,
        travelDate: true,
        rideDepartureTime: true,
        seatNumber: true,
        passenger: { select: { id: true, firstName: true, lastName: true } },
        ride: { select: { id: true, name: true } }
      },
      orderBy: [
        { travelDate: 'asc' },
        { rideDepartureTime: 'asc' },
        { seatNumber: 'asc' },
        { id: 'asc' }
      ]
    })
  ]);

  return {
    scannedReservationCount,
    items: reservations.map((reservation) => ({
      reservationId: reservation.id,
      passengerId: reservation.passenger.id,
      passengerName: `${reservation.passenger.firstName} ${reservation.passenger.lastName}`,
      rideId: reservation.ride.id,
      rideName: reservation.ride.name,
      travelDate: formatDateOnly(reservation.travelDate)!,
      departureTime: reservation.rideDepartureTime,
      seatNumber: reservation.seatNumber
    }))
  };
}

export const reservationGroupPresent: Invariant = {
  key: 'reservation.groupPresent',
  title: 'Svaka rezervacija pripada grupi',
  description:
    'Rezervacija bez grupe nema oznaku G1, G2 i tako dalje na mapi sedista i u spisku putnika. Ova provera obuhvata i istorijske i otkazane rezervacije.',
  severity: 'warning',

  async check(ctx: InvariantContext): Promise<CheckResult> {
    const { items, scannedReservationCount } = await findReservationsWithoutGroup(ctx);

    return {
      scannedCount: scannedReservationCount,
      violations: items.map((item) => ({
        subjectType: 'reservation' as const,
        subjectId: item.reservationId,
        summary: `${item.passengerName}, ${item.travelDate}, polazak ${item.departureTime}, sediste ${item.seatNumber}: rezervacija nema grupu.`,
        detail: { ...item },
        canRepair: false
      }))
    };
  }
};
