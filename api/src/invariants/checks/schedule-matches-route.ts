import {
  describeScheduleDrift,
  isScheduleAlignedToRoute,
  realignDayScheduleTx,
  routeStationIdsOf
} from '../../rides/ride-schedule-alignment';
import { CheckResult, Invariant, InvariantContext, RepairResult } from '../invariant.types';
import { loadStationNames, stationNamer } from './tenant-lookups';

/**
 * A ride's day schedule carries its own copy of the line's station list. Adding
 * or removing a stop on the line does not touch it, so the copy goes stale and
 * the ride can no longer be edited until the two agree again.
 */

export interface ScheduleDriftItem {
  rideId: string;
  rideName: string;
  lineId: string;
  lineName: string;
  dayOfWeek: number;
  scheduleStationCount: number;
  routeStationCount: number;
  addedStationNames: string[];
  removedStationNames: string[];
  reorderedStationNames: string[];
}

export interface DriftedSchedule {
  item: ScheduleDriftItem;
  tenantId: string;
  rideDayScheduleId: string;
  stationTimes: Array<{ stationId: string; orderIndex: number; time: string | null }>;
  routeStationIds: string[];
}

export async function findDriftedSchedules(
  ctx: InvariantContext
): Promise<{ drifted: DriftedSchedule[]; scannedScheduleCount: number }> {
  const lines = await ctx.prisma.line.findMany({
    where: { tenantId: ctx.tenantId },
    select: {
      id: true,
      name: true,
      departureStationId: true,
      arrivalStationId: true,
      intermediateStops: {
        select: { stationId: true, orderIndex: true },
        orderBy: { orderIndex: 'asc' }
      },
      rides: {
        select: {
          id: true,
          name: true,
          daySchedules: {
            select: {
              id: true,
              dayOfWeek: true,
              stationTimes: {
                select: { stationId: true, orderIndex: true, time: true },
                orderBy: { orderIndex: 'asc' }
              }
            }
          }
        }
      }
    }
  });

  const toNames = stationNamer(await loadStationNames(ctx));
  const drifted: DriftedSchedule[] = [];
  let scannedScheduleCount = 0;

  for (const line of lines) {
    const routeStationIds = routeStationIdsOf(line);

    for (const ride of line.rides) {
      for (const daySchedule of ride.daySchedules) {
        scannedScheduleCount += 1;

        if (isScheduleAlignedToRoute(daySchedule.stationTimes, routeStationIds)) {
          continue;
        }

        const drift = describeScheduleDrift(daySchedule.stationTimes, routeStationIds);
        const names = (stationIds: string[]) => stationIds.map(toNames);

        drifted.push({
          tenantId: ctx.tenantId,
          rideDayScheduleId: daySchedule.id,
          stationTimes: daySchedule.stationTimes,
          routeStationIds,
          item: {
            rideId: ride.id,
            rideName: ride.name,
            lineId: line.id,
            lineName: line.name,
            dayOfWeek: daySchedule.dayOfWeek,
            scheduleStationCount: daySchedule.stationTimes.length,
            routeStationCount: routeStationIds.length,
            addedStationNames: names(drift.addedStationIds),
            removedStationNames: names(drift.removedStationIds),
            reorderedStationNames: names(drift.reorderedStationIds)
          }
        });
      }
    }
  }

  return { drifted, scannedScheduleCount };
}

export interface RealignOutcome {
  drifted: DriftedSchedule[];
  estimatedTimeCount: number;
  reorderedScheduleCount: number;
}

export async function realignDriftedSchedules(ctx: InvariantContext): Promise<RealignOutcome> {
  const { drifted } = await findDriftedSchedules(ctx);

  // Each schedule is repaired in its own transaction so one failure cannot
  // roll back repairs that already succeeded.
  let estimatedTimeCount = 0;
  let reorderedScheduleCount = 0;

  for (const entry of drifted) {
    const result = await ctx.prisma.$transaction((tx) =>
      realignDayScheduleTx(tx, {
        tenantId: entry.tenantId,
        rideDayScheduleId: entry.rideDayScheduleId,
        stationTimes: entry.stationTimes,
        routeStationIds: entry.routeStationIds,
        actorId: ctx.actorId
      })
    );

    estimatedTimeCount += result.estimatedTimeCount;
    reorderedScheduleCount += result.reorderedScheduleIds.length;
  }

  return { drifted, estimatedTimeCount, reorderedScheduleCount };
}

const DAY_LABELS = ['nedeljom', 'ponedeljkom', 'utorkom', 'sredom', 'cetvrtkom', 'petkom', 'subotom'];

export const scheduleMatchesRoute: Invariant = {
  key: 'schedule.matchesRoute',
  title: 'Raspored voznje prati rutu linije',
  description:
    'Raspored voznje drzi svoju kopiju liste stanica. Kada se stanica doda ili ukloni sa linije, ta kopija ostaje stara i voznja ne moze da se izmeni dok se ne uskladi.',
  severity: 'warning',

  async check(ctx: InvariantContext): Promise<CheckResult> {
    const { drifted, scannedScheduleCount } = await findDriftedSchedules(ctx);

    return {
      scannedCount: scannedScheduleCount,
      violations: drifted.map((entry) => ({
        subjectType: 'ride-schedule' as const,
        subjectId: entry.rideDayScheduleId,
        summary: `Voznja "${entry.item.rideName}" ${DAY_LABELS[entry.item.dayOfWeek] ?? ''} ima ${entry.item.scheduleStationCount} stanica, a ruta ${entry.item.routeStationCount}.`,
        detail: { ...entry.item },
        canRepair: true
      }))
    };
  },

  async repair(ctx: InvariantContext): Promise<RepairResult> {
    const { drifted } = await realignDriftedSchedules(ctx);

    return { repairedCount: drifted.length, skippedCount: 0 };
  }
};
