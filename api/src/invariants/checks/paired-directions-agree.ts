import { Prisma } from '@prisma/client';
import {
  mergePairedRoutes,
  orderedStopIds,
  stopsForDirection,
  writeLineStopsTx,
  type PairedRouteLine
} from '../../lines/line-pair-alignment';
import {
  isScheduleAlignedToRoute,
  realignDayScheduleTx
} from '../../rides/ride-schedule-alignment';
import { CheckResult, Invariant, InvariantContext, RepairResult } from '../invariant.types';
import { loadPairs, loadStationNames, stationNamer } from './tenant-lookups';

/**
 * The two directions of a paired line each store their own stop list, and a
 * stop added to one is not added to the other. The directions then disagree
 * about where the bus calls, which is invisible until somebody tries to sell a
 * ticket through the stop only one side knows about.
 */

export interface PairDriftSideItem {
  id: string;
  name: string;
  stopCount: number;
  missingStationNames: string[];
}

export interface PairDriftItem {
  pairKey: string;
  outbound: PairDriftSideItem;
  inbound: PairDriftSideItem;
  canAutoSync: boolean;
  conflictReason: string | null;
}

export interface DriftedPair {
  item: PairDriftItem;
  outbound: PairedRouteLine;
  inbound: PairedRouteLine;
  /** Null when the two directions genuinely disagree and merging would guess. */
  mergedStopIds: string[] | null;
}

export async function findDriftedPairs(
  ctx: InvariantContext
): Promise<{ drifted: DriftedPair[]; scannedPairCount: number }> {
  const { pairs, scannedPairCount } = await loadPairs(ctx);
  const toName = stationNamer(await loadStationNames(ctx));

  const drifted: DriftedPair[] = [];

  for (const { pairKey, outbound, inbound, outboundName, inboundName } of pairs) {
    const outboundStopIds = orderedStopIds(outbound);
    const inboundReversed = [...orderedStopIds(inbound)].reverse();

    if (
      outboundStopIds.length === inboundReversed.length &&
      outboundStopIds.every((stationId, index) => stationId === inboundReversed[index])
    ) {
      continue;
    }

    const merge = mergePairedRoutes(outboundStopIds, inboundReversed);
    const toNames = (ids: string[]) => ids.map(toName);

    drifted.push({
      outbound,
      inbound,
      mergedStopIds: merge.merged ?? null,
      item: {
        pairKey,
        outbound: {
          id: outbound.id,
          name: outboundName,
          stopCount: outboundStopIds.length,
          missingStationNames: toNames(
            inboundReversed.filter((id) => !outboundStopIds.includes(id))
          )
        },
        inbound: {
          id: inbound.id,
          name: inboundName,
          stopCount: inboundReversed.length,
          missingStationNames: toNames(
            outboundStopIds.filter((id) => !inboundReversed.includes(id))
          )
        },
        canAutoSync: Boolean(merge.merged),
        conflictReason: merge.conflict ?? null
      }
    });
  }

  return { drifted, scannedPairCount };
}

export interface PairSyncOutcome {
  drifted: DriftedPair[];
  syncedPairCount: number;
  addedStopCount: number;
  realignedScheduleCount: number;
  skippedPairCount: number;
}

export async function syncDriftedPairs(ctx: InvariantContext): Promise<PairSyncOutcome> {
  const { drifted } = await findDriftedPairs(ctx);

  let syncedPairCount = 0;
  let addedStopCount = 0;
  let realignedScheduleCount = 0;
  let skippedPairCount = 0;

  for (const entry of drifted) {
    // A genuine disagreement between directions is never resolved by guessing.
    if (!entry.mergedStopIds) {
      skippedPairCount += 1;
      continue;
    }

    const mergedStopIds = entry.mergedStopIds;

    const written = await ctx.prisma.$transaction(async (tx) => {
      let scheduleCount = 0;
      let stopCount = 0;

      for (const { line, reverse, opposite } of [
        { line: entry.outbound, reverse: false, opposite: entry.inbound },
        { line: entry.inbound, reverse: true, opposite: entry.outbound }
      ]) {
        const nextStops = stopsForDirection(line, mergedStopIds, reverse, opposite);
        stopCount += Math.max(nextStops.length - line.intermediateStops.length, 0);

        await writeLineStopsTx(tx, ctx.tenantId, line.id, ctx.actorId, nextStops);

        scheduleCount += await reconcileSchedulesForLineTx(tx, ctx.tenantId, ctx.actorId, line.id, [
          line.departureStationId,
          ...nextStops.map((stop) => stop.stationId),
          line.arrivalStationId
        ]);
      }

      return { scheduleCount, stopCount };
    });

    syncedPairCount += 1;
    addedStopCount += written.stopCount;
    realignedScheduleCount += written.scheduleCount;
  }

  return { drifted, syncedPairCount, addedStopCount, realignedScheduleCount, skippedPairCount };
}

/**
 * Rewriting a route leaves every schedule on it holding the old station list,
 * so the repair that changes the route also has to bring the schedules along —
 * otherwise fixing one invariant breaks another.
 */
async function reconcileSchedulesForLineTx(
  tx: Prisma.TransactionClient,
  tenantId: string,
  actorId: string,
  lineId: string,
  routeStationIds: string[]
): Promise<number> {
  const rides = await tx.ride.findMany({
    where: { lineId, tenantId },
    select: {
      daySchedules: {
        select: {
          id: true,
          stationTimes: {
            select: { stationId: true, orderIndex: true, time: true },
            orderBy: { orderIndex: 'asc' }
          }
        }
      }
    }
  });

  let realigned = 0;

  for (const ride of rides) {
    for (const daySchedule of ride.daySchedules) {
      if (isScheduleAlignedToRoute(daySchedule.stationTimes, routeStationIds)) {
        continue;
      }

      await realignDayScheduleTx(tx, {
        tenantId,
        rideDayScheduleId: daySchedule.id,
        stationTimes: daySchedule.stationTimes,
        routeStationIds,
        actorId
      });

      realigned += 1;
    }
  }

  return realigned;
}

export const pairedDirectionsAgree: Invariant = {
  key: 'pair.directionsAgree',
  title: 'Oba smera linije nose iste medjustanice',
  description:
    'Svaki smer para cuva svoju listu stanica. Stanica dodata na jedan smer ne pojavljuje se na drugom, pa se smerovi tiho raziđu i karta preko te stanice ne moze da se proda u oba pravca.',
  severity: 'warning',

  async check(ctx: InvariantContext): Promise<CheckResult> {
    const { drifted, scannedPairCount } = await findDriftedPairs(ctx);

    return {
      scannedCount: scannedPairCount,
      violations: drifted.map((entry) => ({
        subjectType: 'line-pair' as const,
        subjectId: entry.item.pairKey,
        summary: `Smerovi "${entry.item.outbound.name}" i "${entry.item.inbound.name}" ne nose iste medjustanice.`,
        detail: { ...entry.item },
        canRepair: entry.item.canAutoSync
      }))
    };
  },

  async repair(ctx: InvariantContext): Promise<RepairResult> {
    const { syncedPairCount, skippedPairCount } = await syncDriftedPairs(ctx);

    return { repairedCount: syncedPairCount, skippedCount: skippedPairCount };
  }
};
