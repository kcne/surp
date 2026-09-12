import { segmentsOverlap } from '../../reservations/route-segment';
import { CheckResult, Invariant, InvariantContext } from '../invariant.types';
import { InstanceOccupancy, OccupiedSeat, loadInstanceOccupancy } from './seat-occupancy';
import { loadStationNames, stationNamer } from './tenant-lookups';

/**
 * Two passengers cannot sit in the same seat at the same time.
 *
 * Nothing in the database says so. Seat uniqueness is enforced only in
 * `ensureSeatAndCapacityAreAvailable`, under an advisory lock keyed on the
 * departure time — and when that time drifts, the lock and the check move to a
 * different key while the passengers stay on the same bus. A stale browser tab
 * holding a departure list loaded before a route edit is enough: it sends the
 * old time, takes a different lock, and the booking goes through.
 *
 * A `UNIQUE` constraint would be the wrong fix and must not be added. The same
 * seat is legitimately sold twice on one run when the two passengers travel
 * disjoint legs — Belgrade to Novi Sad, then Novi Sad onward — which is why
 * this compares segments rather than seat numbers alone. The right constraint
 * is an `EXCLUDE` over the segment as an `int4range`, and it has to wait until
 * the segment is stored on the reservation instead of derived from the current
 * route on every read (#19).
 *
 * Reported, never repaired. Both bookings are real, both passengers were told a
 * seat number, and deciding which of them is moved — or called — is the
 * agency's call, not a default.
 */

export interface SeatClashItem {
  instanceKey: string;
  rideName: string;
  lineName: string;
  travelDate: string;
  departureTime: string;
  seatNumber: number;
  /** The reservation that would be listed second, and is reported as the clash. */
  reservationId: string;
  passengerName: string;
  passengerPhone: string;
  segmentLabel: string;
  /** The reservation it collides with. */
  otherReservationId: string;
  otherPassengerName: string;
  otherPassengerPhone: string;
  otherSegmentLabel: string;
  /**
   * Whether either side reached this departure through a drifted time, which
   * is the shape that hides a clash from the booking check.
   */
  fromDriftedTime: boolean;
}

export async function findSeatClashes(
  ctx: InvariantContext
): Promise<{ items: SeatClashItem[]; scannedReservationCount: number }> {
  const scan = await loadInstanceOccupancy(ctx);
  const toName = stationNamer(await loadStationNames(ctx));
  const items: SeatClashItem[] = [];

  for (const instance of scan.instances) {
    const bySeat = new Map<number, OccupiedSeat[]>();

    for (const seat of instance.seats) {
      bySeat.set(seat.seatNumber, [...(bySeat.get(seat.seatNumber) ?? []), seat]);
    }

    for (const held of bySeat.values()) {
      // Every pair, not just neighbours: three reservations on one seat can
      // overlap in any combination, and an agency that sees only two of the
      // three clashes moves one passenger and thinks it is done.
      for (let i = 0; i < held.length; i += 1) {
        for (let j = i + 1; j < held.length; j += 1) {
          if (!segmentsOverlap(held[i].segment, held[j].segment)) {
            continue;
          }

          items.push(clashItem(instance, held[i], held[j], toName));
        }
      }
    }
  }

  return { items, scannedReservationCount: scan.scannedReservationCount };
}

function clashItem(
  instance: InstanceOccupancy,
  first: OccupiedSeat,
  second: OccupiedSeat,
  toName: (stationId: string) => string
): SeatClashItem {
  const segmentLabel = (seat: OccupiedSeat) =>
    `${toName(seat.departureStationId)} - ${toName(seat.arrivalStationId)}`;

  return {
    instanceKey: instance.instanceKey,
    rideName: instance.rideName,
    lineName: instance.lineName,
    travelDate: instance.travelDate,
    departureTime: instance.departureTime,
    seatNumber: second.seatNumber,
    reservationId: second.reservationId,
    passengerName: second.passengerName,
    passengerPhone: second.passengerPhone,
    segmentLabel: segmentLabel(second),
    otherReservationId: first.reservationId,
    otherPassengerName: first.passengerName,
    otherPassengerPhone: first.passengerPhone,
    otherSegmentLabel: segmentLabel(first),
    fromDriftedTime: first.drifted || second.drifted
  };
}

export const reservationSeatUnique: Invariant = {
  key: 'reservation.seatUnique',
  title: 'Jedno sediste nosi samo jednog putnika',
  description:
    'Isto sediste sme da se proda dvaput na istom polasku samo ako se putovanja ne preklapaju — jedan putnik izadje pre nego sto drugi udje. Kada se preklapaju, dva putnika dolaze na isto mesto. Baza to ne sprecava: provera radi samo pri upisu i vezana je za vreme polaska, pa kada se vreme polaska promeni, provera i ne vidi rezervacije upisane pre izmene.',
  severity: 'critical',

  async check(ctx: InvariantContext): Promise<CheckResult> {
    const { items, scannedReservationCount } = await findSeatClashes(ctx);

    return {
      scannedCount: scannedReservationCount,
      violations: items.map((item) => ({
        subjectType: 'reservation' as const,
        subjectId: item.reservationId,
        summary: `Sediste ${item.seatNumber}, ${item.travelDate}, polazak ${item.departureTime}: ${item.passengerName} (${item.segmentLabel}) i ${item.otherPassengerName} (${item.otherSegmentLabel}) putuju u isto vreme.`,
        detail: { ...item },
        canRepair: false
      }))
    };
  }

  // No repair: both passengers hold a seat number they were given, and which
  // of the two is moved is a decision the agency makes by telephone.
};
