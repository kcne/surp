import { Injectable } from '@nestjs/common';
import { AccessTokenPayload } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  describeScheduleDrift,
  isScheduleAlignedToRoute,
  realignDayScheduleTx,
  routeStationIdsOf
} from '../rides/ride-schedule-alignment';
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

  private async getStationNameLookup(tenantId: string): Promise<Map<string, string>> {
    const stations = await this.prisma.station.findMany({
      where: { tenantId },
      select: { id: true, name: true }
    });

    return new Map(stations.map((station) => [station.id, station.name]));
  }
}
