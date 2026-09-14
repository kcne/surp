import { segmentCoversLeg } from '../../reservations/route-segment';
import { CheckResult, Invariant, InvariantContext } from '../invariant.types';
import { InstanceOccupancy, legLabel, loadInstanceOccupancy } from './seat-occupancy';
import { loadStationNames, stationNamer } from './tenant-lookups';

/**
 * No departure carries more passengers than it has seats.
 *
 * Counted leg by leg, because that is the only place the question has an
 * answer: a 48-seat bus can carry far more than 48 people across a full route
 * as passengers get on and off, and it is over capacity the moment any single
 * stretch between two stations holds more than 48 of them at once.
 *
 * `reservation.seatUnique` catches two passengers on one seat. This catches the
 * other shape of the same failure — more passengers than seats with no two of
 * them naming the same number, which is what happens when reservations split
 * across departure times are counted against capacity separately, and when
 * capacity is lowered under a full bus.
 *
 * Reported, never repaired: the fix is a bigger bus or a phone call.
 */

export interface OverbookedLegItem {
  instanceKey: string;
  rideName: string;
  lineName: string;
  travelDate: string;
  departureTime: string;
  capacity: number;
  /** The busiest leg, named by the two stations it runs between. */
  legLabel: string;
  passengerCount: number;
  /** How many seats short the bus is on that leg. */
  excessCount: number;
  reservationIds: string[];
}

export async function findOverbookedInstances(
  ctx: InvariantContext
): Promise<{ items: OverbookedLegItem[]; scannedInstanceCount: number }> {
  const scan = await loadInstanceOccupancy(ctx);
  const toName = stationNamer(await loadStationNames(ctx));
  const items: OverbookedLegItem[] = [];

  for (const instance of scan.instances) {
    const busiest = busiestLeg(instance);

    if (!busiest || busiest.reservationIds.length <= instance.capacity) {
      continue;
    }

    items.push({
      instanceKey: instance.instanceKey,
      rideName: instance.rideName,
      lineName: instance.lineName,
      travelDate: instance.travelDate,
      departureTime: instance.departureTime,
      capacity: instance.capacity,
      legLabel: legLabel(instance, busiest.order, toName),
      passengerCount: busiest.reservationIds.length,
      excessCount: busiest.reservationIds.length - instance.capacity,
      reservationIds: busiest.reservationIds
    });
  }

  return { items, scannedInstanceCount: scan.instances.length };
}

/**
 * The leg carrying the most passengers at once.
 *
 * Only the worst one is reported. An overbooked bus is usually overbooked on
 * several consecutive legs by the same passengers, and listing each of them
 * would turn one full bus into a page of findings that all need the same
 * single decision.
 */
function busiestLeg(
  instance: InstanceOccupancy
): { order: number; reservationIds: string[] } | null {
  let worst: { order: number; reservationIds: string[] } | null = null;

  for (let order = 0; order < instance.stationIds.length - 1; order += 1) {
    const reservationIds = instance.seats
      .filter((seat) => segmentCoversLeg(seat.segment, order))
      .map((seat) => seat.reservationId);

    if (!worst || reservationIds.length > worst.reservationIds.length) {
      worst = { order, reservationIds };
    }
  }

  return worst;
}

export const instanceNotOverbooked: Invariant = {
  key: 'instance.notOverbooked',
  title: 'Polazak ne nosi vise putnika nego sto ima mesta',
  description:
    'Broj putnika se racuna po deonici: isti autobus tokom cele rute moze da preveze vise ljudi nego sto ima sedista, ali na jednoj deonici ne sme da ih bude vise od kapaciteta. Kada se vreme polaska promeni ili se kapacitet smanji, rezervacije se broje odvojeno i autobus tiho ostane prepun.',
  severity: 'critical',

  async check(ctx: InvariantContext): Promise<CheckResult> {
    const { items, scannedInstanceCount } = await findOverbookedInstances(ctx);

    return {
      scannedCount: scannedInstanceCount,
      violations: items.map((item) => ({
        subjectType: 'ride-instance' as const,
        subjectId: item.instanceKey,
        summary: `${item.rideName}, ${item.travelDate}, polazak ${item.departureTime}: ${item.passengerCount} putnika na deonici ${item.legLabel}, a kapacitet je ${item.capacity}.`,
        detail: { ...item },
        canRepair: false
      }))
    };
  }

  // No repair: fitting the passengers is a bigger bus or a telephone call.
};
