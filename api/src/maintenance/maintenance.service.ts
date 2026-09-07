import { Injectable } from '@nestjs/common';
import { LineDirection, LineDirectionMode, Prisma } from '@prisma/client';
import { AccessTokenPayload } from '../auth/auth.types';
import {
  mergePairedRoutes,
  orderedStopIds,
  stopsForDirection,
  writeLineStopsTx,
  type PairedRouteLine
} from '../lines/line-pair-alignment';
import { PrismaService } from '../prisma/prisma.service';
import {
  describeScheduleDrift,
  isScheduleAlignedToRoute,
  realignDayScheduleTx,
  routeStationIdsOf
} from '../rides/ride-schedule-alignment';
import {
  PairDriftItemDto,
  PairDriftReportDto,
  PairSyncResultDto
} from './dto/pair-drift.response.dto';
import {
  ScheduleDriftItemDto,
  ScheduleDriftReportDto,
  ScheduleRealignResultDto
} from './dto/schedule-drift.response.dto';

interface DriftedSchedule {
  item: ScheduleDriftItemDto;
  tenantId: string;
  rideDayScheduleId: string;
  stationTimes: Array<{ stationId: string; orderIndex: number; time: string | null }>;
  routeStationIds: string[];
}

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getScheduleDriftReport(auth: AccessTokenPayload): Promise<ScheduleDriftReportDto> {
    const { drifted, scannedScheduleCount } = await this.findDriftedSchedules(auth.tenantId);

    return {
      scannedScheduleCount,
      driftedScheduleCount: drifted.length,
      affectedRideCount: new Set(drifted.map((entry) => entry.item.rideId)).size,
      items: drifted.map((entry) => entry.item)
    };
  }

  async realignSchedules(auth: AccessTokenPayload): Promise<ScheduleRealignResultDto> {
    const { drifted } = await this.findDriftedSchedules(auth.tenantId);

    // Each schedule is repaired in its own transaction so one failure cannot
    // roll back repairs that already succeeded.
    let estimatedTimeCount = 0;

    let reorderedScheduleCount = 0;

    for (const entry of drifted) {
      const result = await this.prisma.$transaction((tx) =>
        realignDayScheduleTx(tx, {
          tenantId: entry.tenantId,
          rideDayScheduleId: entry.rideDayScheduleId,
          stationTimes: entry.stationTimes,
          routeStationIds: entry.routeStationIds,
          actorId: auth.sub
        })
      );

      estimatedTimeCount += result.estimatedTimeCount;
      reorderedScheduleCount += result.reorderedScheduleIds.length;
    }

    return {
      realignedScheduleCount: drifted.length,
      affectedRideCount: new Set(drifted.map((entry) => entry.item.rideId)).size,
      estimatedTimeCount,
      reorderedScheduleCount,
      items: drifted.map((entry) => entry.item)
    };
  }

  private async findDriftedSchedules(
    tenantId: string
  ): Promise<{ drifted: DriftedSchedule[]; scannedScheduleCount: number }> {
    const lines = await this.prisma.line.findMany({
      where: { tenantId },
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

    const stationNameById = await this.getStationNameLookup(tenantId);
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
          const toNames = (stationIds: string[]) =>
            stationIds.map((stationId) => stationNameById.get(stationId) ?? stationId);

          drifted.push({
            tenantId,
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
              addedStationNames: toNames(drift.addedStationIds),
              removedStationNames: toNames(drift.removedStationIds),
              reorderedStationNames: toNames(drift.reorderedStationIds)
            }
          });
        }
      }
    }

    return { drifted, scannedScheduleCount };
  }

  async getPairDriftReport(auth: AccessTokenPayload): Promise<PairDriftReportDto> {
    const { drifted, scannedPairCount } = await this.findDriftedPairs(auth.tenantId);

    return {
      scannedPairCount,
      driftedPairCount: drifted.length,
      items: drifted.map((entry) => entry.item)
    };
  }

  async syncPairs(auth: AccessTokenPayload): Promise<PairSyncResultDto> {
    const { drifted } = await this.findDriftedPairs(auth.tenantId);

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

      const written = await this.prisma.$transaction(async (tx) => {
        let scheduleCount = 0;
        let stopCount = 0;

        for (const { line, reverse } of [
          { line: entry.outbound, reverse: false },
          { line: entry.inbound, reverse: true }
        ]) {
          const nextStops = stopsForDirection(line, mergedStopIds, reverse);
          stopCount += Math.max(nextStops.length - line.intermediateStops.length, 0);

          await writeLineStopsTx(tx, auth.tenantId, line.id, auth.sub, nextStops);

          scheduleCount += await this.reconcileSchedulesForLineTx(tx, auth.tenantId, auth.sub, line.id, [
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

    return {
      syncedPairCount,
      addedStopCount,
      realignedScheduleCount,
      skippedPairCount,
      items: drifted.map((entry) => entry.item)
    };
  }

  private async reconcileSchedulesForLineTx(
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

  private async findDriftedPairs(tenantId: string): Promise<{
    drifted: Array<{
      item: PairDriftItemDto;
      outbound: PairedRouteLine;
      inbound: PairedRouteLine;
      mergedStopIds: string[] | null;
    }>;
    scannedPairCount: number;
  }> {
    const lines = await this.prisma.line.findMany({
      where: {
        tenantId,
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
          select: { stationId: true, orderIndex: true },
          orderBy: { orderIndex: 'asc' }
        }
      }
    });

    const byPairKey = new Map<string, typeof lines>();
    lines.forEach((line) => {
      const key = line.pairKey!;
      byPairKey.set(key, [...(byPairKey.get(key) ?? []), line]);
    });

    const stationNameById = await this.getStationNameLookup(tenantId);
    const drifted: Array<{
      item: PairDriftItemDto;
      outbound: PairedRouteLine;
      inbound: PairedRouteLine;
      mergedStopIds: string[] | null;
    }> = [];
    let scannedPairCount = 0;

    for (const [pairKey, group] of Array.from(byPairKey.entries())) {
      // Only a clean two-sided pair can be reasoned about.
      if (group.length !== 2) {
        continue;
      }

      scannedPairCount += 1;

      const outbound = group.find((line) => line.direction === LineDirection.OUTBOUND) ?? group[0];
      const inbound = group.find((line) => line.id !== outbound.id)!;

      const outboundStopIds = orderedStopIds(outbound);
      const inboundReversed = [...orderedStopIds(inbound)].reverse();

      if (
        outboundStopIds.length === inboundReversed.length &&
        outboundStopIds.every((stationId, index) => stationId === inboundReversed[index])
      ) {
        continue;
      }

      const merge = mergePairedRoutes(outboundStopIds, inboundReversed);
      const toNames = (ids: string[]) => ids.map((id) => stationNameById.get(id) ?? id);

      drifted.push({
        outbound,
        inbound,
        mergedStopIds: merge.merged ?? null,
        item: {
          pairKey,
          outbound: {
            id: outbound.id,
            name: outbound.name,
            stopCount: outboundStopIds.length,
            missingStationNames: toNames(
              inboundReversed.filter((id) => !outboundStopIds.includes(id))
            )
          },
          inbound: {
            id: inbound.id,
            name: inbound.name,
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

  private async getStationNameLookup(tenantId: string): Promise<Map<string, string>> {
    const stations = await this.prisma.station.findMany({
      where: { tenantId },
      select: { id: true, name: true }
    });

    return new Map(stations.map((station) => [station.id, station.name]));
  }
}
