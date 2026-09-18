import { RideStatus } from '@prisma/client';
import { CheckResult, InvariantContext, ProspectiveInvariant } from '../invariant.types';
import { serbianPlural } from '../serbian-plural';

/**
 * No ACTIVE ride sits on a deactivated line.
 *
 * `listInstancesByDate` used to filter only on `ride.status === ACTIVE` and
 * never looked at `line.isActive`, so a deactivated line kept producing
 * departures and accepting reservations — the read side has since been
 * fixed to also require `line.isActive`, and reservation creation now
 * refuses a ride whose line is inactive.
 *
 * Deactivating a line deliberately does not cascade to its rides: a ride's
 * own ACTIVE/INACTIVE status is a separate, agency-set fact, and forcing it
 * to follow the line would make reactivating the line silently reactivate
 * rides nobody asked to bring back. Instead every path that would produce a
 * bookable departure gates on both facts, and this check is what surfaces
 * the ones still combined the wrong way — for example a ride left ACTIVE
 * after its line was deactivated, which this check flags as worth an
 * explicit decision even though the read paths already hide it from
 * customers.
 *
 * Reported, never repaired. Reactivating the line and marking the ride
 * INACTIVE are both reasonable, and only the agency knows which one is true.
 */

export interface RideOnInactiveLineItem {
  rideId: string;
  rideName: string;
  lineId: string;
  lineName: string;
}

export async function findActiveRidesOnInactiveLines(
  ctx: InvariantContext
): Promise<{ items: RideOnInactiveLineItem[]; scannedRideCount: number }> {
  const rides = await ctx.prisma.ride.findMany({
    where: {
      tenantId: ctx.tenantId,
      status: RideStatus.ACTIVE
    },
    select: {
      id: true,
      name: true,
      line: { select: { id: true, name: true, isActive: true } }
    }
  });

  const items = rides
    .filter((ride) => !ride.line.isActive)
    .map((ride) => ({
      rideId: ride.id,
      rideName: ride.name,
      lineId: ride.line.id,
      lineName: ride.line.name
    }));

  return { items, scannedRideCount: rides.length };
}

export const rideLineActive: ProspectiveInvariant = {
  key: 'ride.lineActive',
  title: 'Voznja je na aktivnoj liniji',
  description:
    'Deaktiviranje linije ne menja status voznji koje na njoj saobracaju. Aktivna voznja na deaktiviranoj liniji je nedosledno stanje koje agencija treba svesno da resi.',
  manualAdvice:
    'Odlucite sta je tacno: ako linija vise ne saobraca, deaktivirajte i voznje na njoj; ako saobraca, vratite liniju medju aktivne.',
  severity: 'warning',

  breakingChangeMessage: (count) =>
    `Ova izmena ostavlja ${serbianPlural(count, 'voznju', 'voznje', 'voznji')} na neaktivnoj liniji.`,

  async check(ctx: InvariantContext): Promise<CheckResult> {
    const { items, scannedRideCount } = await findActiveRidesOnInactiveLines(ctx);

    return {
      scannedCount: scannedRideCount,
      violations: items.map((item) => ({
        subjectType: 'ride-schedule' as const,
        subjectId: item.rideId,
        summary: `Voznja "${item.rideName}" je aktivna na deaktiviranoj liniji "${item.lineName}".`,
        detail: { ...item },
        canRepair: false
      }))
    };
  }

  // No repair: reactivating the line and marking the ride inactive are both
  // reasonable, and only the agency knows which one is intended.
};
