import { LineDirection, LineDirectionMode } from '@prisma/client';
import { type PairedRouteLine } from '../../lines/line-pair-alignment';
import { InvariantContext } from '../invariant.types';

/**
 * Loads shared by more than one check. Both pair checks need the same view of a
 * tenant's paired lines, and every check turns station ids into names before a
 * human reads them.
 */

export interface LoadedPair {
  pairKey: string;
  outbound: PairedRouteLine;
  inbound: PairedRouteLine;
  outboundName: string;
  inboundName: string;
}

/**
 * Every complete two-sided BOTH pair in the tenant, with the two directions
 * identified. A group that is not exactly two lines cannot be reasoned about as
 * a pair and is skipped.
 */
export async function loadPairs(
  ctx: InvariantContext
): Promise<{ pairs: LoadedPair[]; scannedPairCount: number }> {
  const lines = await ctx.prisma.line.findMany({
    where: {
      tenantId: ctx.tenantId,
      directionMode: LineDirectionMode.BOTH,
      pairKey: { not: null }
    },
    select: {
      id: true,
      name: true,
      pairKey: true,
      direction: true,
      departureStationId: true,
      arrivalStationId: true,
      intermediateStops: {
        select: {
          stationId: true,
          orderIndex: true,
          isBoarding: true,
          isDropoff: true
        },
        orderBy: { orderIndex: 'asc' }
      }
    }
  });

  const byPairKey = new Map<string, typeof lines>();
  lines.forEach((line) => {
    const key = line.pairKey!;
    byPairKey.set(key, [...(byPairKey.get(key) ?? []), line]);
  });

  const pairs: LoadedPair[] = [];

  for (const [pairKey, group] of Array.from(byPairKey.entries())) {
    if (group.length !== 2) {
      continue;
    }

    const outbound = group.find((line) => line.direction === LineDirection.OUTBOUND) ?? group[0];
    const inbound = group.find((line) => line.id !== outbound.id)!;

    pairs.push({
      pairKey,
      outbound,
      inbound,
      outboundName: outbound.name,
      inboundName: inbound.name
    });
  }

  return { pairs, scannedPairCount: pairs.length };
}

export async function loadStationNames(ctx: InvariantContext): Promise<Map<string, string>> {
  const stations = await ctx.prisma.station.findMany({
    where: { tenantId: ctx.tenantId },
    select: { id: true, name: true }
  });

  return new Map(stations.map((station) => [station.id, station.name]));
}

/** Falls back to the id so a violation is never rendered with a blank station. */
export function stationNamer(
  stationNameById: Map<string, string>
): (stationId: string) => string {
  return (stationId) => stationNameById.get(stationId) ?? stationId;
}
