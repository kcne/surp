import { CheckResult, Invariant, InvariantContext } from '../invariant.types';

/**
 * Every station a route names — departure, arrival, or an intermediate stop —
 * is still active.
 *
 * Deactivating a station is unguarded: `stations.service.ts` writes `isActive`
 * straight through and only counts references on delete. A route built against
 * a station that is later deactivated keeps pointing at it, so the agency's
 * timetable still calls at a stop that no longer exists in the operational
 * station list, and any booking made against that stop inherits the same
 * problem invisibly.
 *
 * Reported, never repaired. Whether the station should be reactivated or the
 * route rerouted around it is the same routing decision `stationsOnRoute`
 * already declines to guess at.
 */

export interface RouteInactiveStationItem {
  lineId: string;
  lineName: string;
  inactiveStationNames: string[];
}

export async function findRoutesWithInactiveStations(
  ctx: InvariantContext
): Promise<{ items: RouteInactiveStationItem[]; scannedLineCount: number }> {
  const lines = await ctx.prisma.line.findMany({
    where: { tenantId: ctx.tenantId },
    select: {
      id: true,
      name: true,
      departureStation: { select: { name: true, isActive: true } },
      arrivalStation: { select: { name: true, isActive: true } },
      intermediateStops: {
        select: { station: { select: { name: true, isActive: true } } },
        orderBy: { orderIndex: 'asc' }
      }
    }
  });

  const items: RouteInactiveStationItem[] = [];

  for (const line of lines) {
    const routeStations = [
      line.departureStation,
      line.arrivalStation,
      ...line.intermediateStops.map((stop) => stop.station)
    ];

    const inactiveStationNames = routeStations
      .filter((station) => !station.isActive)
      .map((station) => station.name);

    if (inactiveStationNames.length === 0) {
      continue;
    }

    items.push({
      lineId: line.id,
      lineName: line.name,
      inactiveStationNames: [...new Set(inactiveStationNames)]
    });
  }

  return { items, scannedLineCount: lines.length };
}

export const routeStationsActive: Invariant = {
  key: 'route.stationsActive',
  title: 'Stanice na ruti su aktivne',
  description:
    'Deaktiviranje stanice ne proverava da li je stanica jos uvek deo neke rute. Linija moze i dalje da saobraca preko stanice koja vise nije u operativnoj listi stanica.',
  manualAdvice:
    'Ili vratite stanicu medju aktivne, ili je uklonite sa rute linije. Dok je ovako, linija saobraca preko stanice koje nema u operativnoj listi.',
  severity: 'critical',

  async check(ctx: InvariantContext): Promise<CheckResult> {
    const { items, scannedLineCount } = await findRoutesWithInactiveStations(ctx);

    return {
      scannedCount: scannedLineCount,
      violations: items.map((item) => ({
        subjectType: 'line' as const,
        subjectId: item.lineId,
        summary: `Linija "${item.lineName}" saobraca preko deaktivirane stanice: ${item.inactiveStationNames.join(', ')}.`,
        detail: { ...item },
        canRepair: false
      }))
    };
  }

  // No repair: reactivating the station and rerouting the line around it are
  // both reasonable, and only the agency knows which one matches the field.
};
