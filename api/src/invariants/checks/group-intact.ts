import { ReservationStatus } from '@prisma/client';
import { formatDateOnly, utcDateOf } from '../../rides/ride-instance-materialization';
import { CheckResult, Invariant, InvariantContext } from '../invariant.types';

/**
 * A return ticket is stored as several reservation rows sharing a `groupId`
 * (`reservations.service.ts:113`) — the outbound on one direction, the return
 * on the other, on two different rides. Every write in this area
 * (`update`, `softDelete`) acts on one reservation at a time, with no notion
 * that it might be half of something.
 *
 * The group-aware cancellation path (#9) is the one place that understands
 * this shape. Everywhere else — a single cancellation, a repair, an import —
 * can leave one leg active and the other cancelled, which reads to the agency
 * as a passenger with a confirmed outbound and a return that silently no
 * longer exists, or the reverse.
 *
 * Reported, never repaired: restoring one leg does not imply the other should
 * exist, and whether to cancel the whole group is the agency's decision.
 */

export interface GroupLegItem {
  reservationId: string;
  status: ReservationStatus;
  travelDate: string;
  departureTime: string;
  rideName: string;
  lineName: string;
  passengerName: string;
  passengerPhone: string;
}

export interface BrokenGroupItem {
  groupId: string;
  legs: GroupLegItem[];
  activeLegs: GroupLegItem[];
  cancelledLegs: GroupLegItem[];
}

const GROUP_RESERVATION_SELECT = {
  id: true,
  groupId: true,
  status: true,
  travelDate: true,
  rideDepartureTime: true,
  passenger: { select: { firstName: true, lastName: true, phone: true } },
  ride: { select: { name: true, line: { select: { name: true } } } }
} as const;

export async function findBrokenGroups(
  ctx: InvariantContext
): Promise<{ items: BrokenGroupItem[]; scannedReservationCount: number }> {
  const today = formatDateOnly(new Date())!;
  const windowStart = utcDateOf(today);
  const windowEnd = new Date(windowStart);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + ctx.windowDays);

  // The window only finds candidate groups: a return leg can sit weeks away
  // from its outbound, so once a group is found every one of its rows is
  // pulled regardless of date, or a leg outside the window would read as
  // missing instead of merely out of sight.
  const inWindow = await ctx.prisma.reservation.findMany({
    where: {
      tenantId: ctx.tenantId,
      groupId: { not: null },
      travelDate: { gte: windowStart, lte: windowEnd }
    },
    select: { groupId: true }
  });

  const groupIds = [...new Set(inWindow.map((row) => row.groupId!))];

  if (groupIds.length === 0) {
    return { items: [], scannedReservationCount: 0 };
  }

  const legs = await ctx.prisma.reservation.findMany({
    where: { tenantId: ctx.tenantId, groupId: { in: groupIds } },
    select: GROUP_RESERVATION_SELECT,
    orderBy: [{ travelDate: 'asc' }, { rideDepartureTime: 'asc' }]
  });

  const byGroupId = new Map<string, typeof legs>();
  for (const leg of legs) {
    const key = leg.groupId!;
    byGroupId.set(key, [...(byGroupId.get(key) ?? []), leg]);
  }

  const toItem = (leg: (typeof legs)[number]): GroupLegItem => ({
    reservationId: leg.id,
    status: leg.status,
    travelDate: formatDateOnly(leg.travelDate)!,
    departureTime: leg.rideDepartureTime,
    rideName: leg.ride.name,
    lineName: leg.ride.line.name,
    passengerName: `${leg.passenger.firstName} ${leg.passenger.lastName}`,
    passengerPhone: leg.passenger.phone
  });

  const items: BrokenGroupItem[] = [];

  for (const [groupId, groupLegs] of Array.from(byGroupId.entries())) {
    const allActive = groupLegs.every((leg) => leg.status === ReservationStatus.ACTIVE);
    const allCancelled = groupLegs.every((leg) => leg.status === ReservationStatus.CANCELLED);

    if (allActive || allCancelled) {
      continue;
    }

    const items_ = groupLegs.map(toItem);

    items.push({
      groupId,
      legs: items_,
      activeLegs: items_.filter((leg) => leg.status === ReservationStatus.ACTIVE),
      cancelledLegs: items_.filter((leg) => leg.status === ReservationStatus.CANCELLED)
    });
  }

  return { items, scannedReservationCount: legs.length };
}

export const reservationGroupIntact: Invariant = {
  key: 'reservation.groupIntact',
  title: 'Grupa povratne karte je cela',
  description:
    'Karta u oba smera se cuva kao vise rezervacija sa istim groupId, svaka na svojoj voznji. Otkazivanje van grupne putanje (#9) menja samo jednu od njih, pa putnik ostaje sa potvrdjenim jednim smerom i nevidljivim drugim.',
  manualAdvice:
    'Pozovite putnika i dogovorite se: ili otkazite i preostali smer, ili ponovo upisite otkazani. Sta je od toga putnik trazio ne vidi se iz podataka.',
  severity: 'critical',

  async check(ctx: InvariantContext): Promise<CheckResult> {
    const { items, scannedReservationCount } = await findBrokenGroups(ctx);

    return {
      scannedCount: scannedReservationCount,
      violations: items.map((item) => {
        const passengerName = item.legs[0].passengerName;
        const activeSummary = item.activeLegs
          .map((leg) => `${leg.lineName} ${leg.travelDate} ${leg.departureTime} (aktivna)`)
          .join(', ');
        const cancelledSummary = item.cancelledLegs
          .map((leg) => `${leg.lineName} ${leg.travelDate} ${leg.departureTime} (otkazana)`)
          .join(', ');

        return {
          subjectType: 'reservation-group' as const,
          subjectId: item.groupId,
          summary: `${passengerName}: jedan smer je otkazan a drugi nije — ${activeSummary}; ${cancelledSummary}.`,
          detail: { ...item },
          canRepair: false
        };
      })
    };
  }

  // No repair: restoring one leg does not imply the other should exist, and
  // cancelling the whole group is the agency's decision, not a script's.
};
