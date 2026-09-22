import { ReservationStatus } from '@prisma/client';
import { formatDateOnly, utcDateOf } from '../../rides/ride-instance-materialization';
import { CheckResult, Invariant, InvariantContext } from '../invariant.types';

/**
 * A return leg names the outbound leg it travels back from
 * (`returnOfReservationId`, added in #91). That link is the one relationship in
 * this schema on which "one side cancelled and the other not" is always a
 * defect: two rows, one passenger, the reversed station pair.
 *
 * `groupId` cannot carry it — it is the driver-facing G1/G2 manifest label for
 * a party on one departure, keyed on `rideId:travelDate:rideDepartureTime` by
 * every writer that makes one, so a group never spans two departures and a
 * partially cancelled multi-seat booking is indistinguishable from a
 * half-cancelled round trip. `roundTripId` cannot either: it marks a whole
 * booking, so a three-seat round trip is one marker across six rows.
 *
 * Every write in this area (`update`, `softDelete`) acts on one reservation at
 * a time with no notion that it might be half of something, so a single
 * cancellation, a repair or an import can leave one leg standing and the other
 * gone — which reads to the agency as a passenger holding a confirmed outbound
 * and a return that silently no longer exists, or the reverse.
 *
 * Reported, never repaired: restoring one leg does not imply the other should
 * exist, and cancelling the survivor is the agency's decision, not a script's.
 */

/** Why a pair is broken. Distinguishes which half the agency has to phone about. */
export type BrokenReturnLegReason = 'RETURN_CANCELLED' | 'OUTBOUND_CANCELLED';

export interface ReturnLegItem {
  reservationId: string;
  status: ReservationStatus;
  travelDate: string;
  departureTime: string;
  seatNumber: number;
  rideName: string;
  lineName: string;
}

export interface BrokenReturnLegItem {
  reason: BrokenReturnLegReason;
  passengerName: string;
  passengerPhone: string;
  outbound: ReturnLegItem;
  returnLegs: ReturnLegItem[];
}

const PAIR_RESERVATION_SELECT = {
  id: true,
  status: true,
  travelDate: true,
  rideDepartureTime: true,
  seatNumber: true,
  returnOfReservationId: true,
  passenger: { select: { firstName: true, lastName: true, phone: true } },
  ride: { select: { name: true, line: { select: { name: true } } } }
} as const;

/**
 * A row is part of a pair either by pointing at an outbound leg or by being
 * pointed at. Both ends are searched because either one can be the leg sitting
 * inside the window.
 */
const LINKED_TO_A_PAIR = [
  { returnOfReservationId: { not: null } },
  { returnLegs: { some: {} } }
] as const;

export async function findBrokenReturnLegs(
  ctx: InvariantContext
): Promise<{ items: BrokenReturnLegItem[]; scannedReservationCount: number }> {
  const today = formatDateOnly(new Date())!;
  const windowStart = utcDateOf(today);
  const windowEnd = new Date(windowStart);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + ctx.windowDays);

  // The window only finds candidate pairs: a return leg can sit weeks past its
  // outbound, so once either end is found both rows are pulled regardless of
  // date, or a leg outside the window would read as missing instead of merely
  // out of sight.
  const inWindow = await ctx.prisma.reservation.findMany({
    where: {
      tenantId: ctx.tenantId,
      travelDate: { gte: windowStart, lte: windowEnd },
      OR: [...LINKED_TO_A_PAIR]
    },
    select: { id: true, returnOfReservationId: true }
  });

  const outboundIds = [...new Set(inWindow.map((row) => row.returnOfReservationId ?? row.id))];

  if (outboundIds.length === 0) {
    return { items: [], scannedReservationCount: 0 };
  }

  const legs = await ctx.prisma.reservation.findMany({
    where: {
      tenantId: ctx.tenantId,
      OR: [{ id: { in: outboundIds } }, { returnOfReservationId: { in: outboundIds } }]
    },
    select: PAIR_RESERVATION_SELECT,
    orderBy: [{ travelDate: 'asc' }, { rideDepartureTime: 'asc' }, { id: 'asc' }]
  });

  const wanted = new Set(outboundIds);
  const outboundById = new Map(
    legs.filter((leg) => wanted.has(leg.id)).map((leg) => [leg.id, leg])
  );
  const returnLegsByOutboundId = new Map<string, typeof legs>();

  for (const leg of legs) {
    if (!leg.returnOfReservationId) {
      continue;
    }

    const key = leg.returnOfReservationId;
    returnLegsByOutboundId.set(key, [...(returnLegsByOutboundId.get(key) ?? []), leg]);
  }

  const toItem = (leg: (typeof legs)[number]): ReturnLegItem => ({
    reservationId: leg.id,
    status: leg.status,
    travelDate: formatDateOnly(leg.travelDate)!,
    departureTime: leg.rideDepartureTime,
    seatNumber: leg.seatNumber,
    rideName: leg.ride.name,
    lineName: leg.ride.line.name
  });

  const items: BrokenReturnLegItem[] = [];

  for (const outboundId of outboundIds) {
    const outbound = outboundById.get(outboundId);
    const returnLegs = returnLegsByOutboundId.get(outboundId) ?? [];

    // An outbound leg with nothing pointing at it is a one-way ticket, not a
    // half-dead round trip. Whether every leg sold as a round trip has its
    // counterpart is a different claim and gets its own check.
    if (!outbound || returnLegs.length === 0) {
      continue;
    }

    const outboundIsActive = outbound.status === ReservationStatus.ACTIVE;
    const someReturnIsActive = returnLegs.some((leg) => leg.status === ReservationStatus.ACTIVE);

    // Not "the two statuses disagree". Cancelling a return leg and booking
    // another one is an ordinary agency action — which is why the unique index
    // on the link is partial — so a cancelled return beside a live replacement
    // must stay silent.
    const reason: BrokenReturnLegReason | null =
      outboundIsActive && !someReturnIsActive
        ? 'RETURN_CANCELLED'
        : !outboundIsActive && someReturnIsActive
          ? 'OUTBOUND_CANCELLED'
          : null;

    if (!reason) {
      continue;
    }

    items.push({
      reason,
      passengerName: `${outbound.passenger.firstName} ${outbound.passenger.lastName}`,
      passengerPhone: outbound.passenger.phone,
      outbound: toItem(outbound),
      returnLegs: returnLegs.map(toItem)
    });
  }

  return { items, scannedReservationCount: legs.length };
}

/**
 * Names both departures and both directions.
 *
 * The check this replaced printed the same `lineName` on both sides of the
 * sentence, because the rows it compared sat on one departure. The two legs of
 * a pair travel the reversed station pair, so their line names differ by
 * construction and the operator can tell which half to phone about.
 */
function summaryOf(item: BrokenReturnLegItem): string {
  const departure = (leg: ReturnLegItem) =>
    `${leg.lineName} ${leg.travelDate} ${leg.departureTime}`;
  const outbound = departure(item.outbound);

  if (item.reason === 'RETURN_CANCELLED') {
    // Every link on this outbound is dead — that is the shape — so every one
    // is named. More than one means the return was cancelled, rebooked and
    // cancelled again, which is why the sentence has to agree in number.
    // `serbianPlural` is the wrong tool here: it prefixes a count, and these
    // are named departures rather than a tally.
    const returns = item.returnLegs.map(departure).join(', ');
    const cancelled =
      item.returnLegs.length > 1
        ? `a povratne ${returns} su otkazane.`
        : `a povratna ${returns} je otkazana.`;

    return `${item.passengerName}: odlazna voznja ${outbound} je aktivna, ${cancelled}`;
  }

  // Exactly one, guaranteed by the partial unique index: a cancelled return
  // beside this one would be a replaced leg, not a second live journey.
  const live = item.returnLegs
    .filter((leg) => leg.status === ReservationStatus.ACTIVE)
    .map(departure)
    .join(', ');

  return `${item.passengerName}: povratna voznja ${live} je aktivna, a odlazna ${outbound} je otkazana.`;
}

export const reservationReturnLegIntact: Invariant = {
  key: 'reservation.returnLegIntact',
  title: 'Povratna karta je cela',
  description:
    'Povratna voznja je vezana za svoju odlaznu. Kada se otkaze samo jedna od njih, putnik ostaje sa jednom potvrdjenom voznjom, a druga tiho ne postoji. Otkazana povratna uz upisanu novu nije greska.',
  manualAdvice:
    'Pozovite putnika i dogovorite se: ili otkazite i preostalu voznju, ili ponovo upisite otkazanu. Sta je putnik trazio ne vidi se iz podataka.',
  severity: 'critical',

  async check(ctx: InvariantContext): Promise<CheckResult> {
    const { items, scannedReservationCount } = await findBrokenReturnLegs(ctx);

    return {
      scannedCount: scannedReservationCount,
      violations: items.map((item) => ({
        // The outbound leg keys the pair under both shapes, so a broken pair
        // holds one stable subject whichever half is the cancelled one.
        subjectType: 'reservation' as const,
        subjectId: item.outbound.reservationId,
        summary: summaryOf(item),
        detail: { ...item },
        canRepair: false
      }))
    };
  }

  // No repair: restoring the cancelled leg and cancelling the surviving one are
  // both defensible, and the data does not say which the passenger asked for.
};
