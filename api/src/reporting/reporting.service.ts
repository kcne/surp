import { BadRequestException, Injectable } from '@nestjs/common';
import { ReservationStatus, RideStatus } from '@prisma/client';
import { AccessTokenPayload } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditEntity, ReportingAuditQueryDto } from './dto/reporting-audit.query.dto';
import { ReportingDashboardQueryDto } from './dto/reporting-dashboard.query.dto';
import { ReportingOccupancyQueryDto } from './dto/reporting-occupancy.query.dto';
import {
  AuditItemResponseDto,
  DailyReservationPointResponseDto,
  ReportingAuditResponseDto,
  ReportingDashboardResponseDto,
  ReportingOccupancyResponseDto,
  TopLineMetricResponseDto
} from './dto/reporting.response.dto';

type DateRange = {
  fromDate: Date;
  toDate: Date;
  fromDateIso: string;
  toDateIso: string;
};

type ReservationAnalyticsRow = {
  travelDate: Date;
  rideId: string;
  rideDepartureTime: string;
  status: ReservationStatus;
  passengerId: string;
  ride: {
    capacity: number;
    line: {
      id: string;
      name: string;
    };
  };
};

type AuditBaseRow = {
  id: string;
  createdById: string | null;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class ReportingService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(
    auth: AccessTokenPayload,
    query: ReportingDashboardQueryDto
  ): Promise<ReportingDashboardResponseDto> {
    const range = this.resolveDateRange(query.fromDate, query.toDate);
    const topLinesLimit = query.topLinesLimit ?? 5;

    const [activeRides, activeLines, totalStations, totalPassengers, activePassengers, reservationRows] =
      await Promise.all([
        this.prisma.ride.count({
          where: {
            tenantId: auth.tenantId,
            status: RideStatus.ACTIVE
          }
        }),
        this.prisma.line.count({
          where: {
            tenantId: auth.tenantId,
            isActive: true
          }
        }),
        this.prisma.station.count({
          where: {
            tenantId: auth.tenantId
          }
        }),
        this.prisma.passenger.count({
          where: {
            tenantId: auth.tenantId
          }
        }),
        this.prisma.passenger.count({
          where: {
            tenantId: auth.tenantId,
            isActive: true
          }
        }),
        this.getReservationAnalyticsRows(auth.tenantId, range)
      ]);

    const totals = this.buildReservationTotals(reservationRows);
    const dailyReservations = this.buildDailyReservationPoints(reservationRows);
    const topLines = this.buildTopLines(reservationRows, topLinesLimit);

    return {
      range: {
        fromDate: range.fromDateIso,
        toDate: range.toDateIso
      },
      summary: {
        activeRides,
        activeLines,
        totalStations,
        totalPassengers,
        activePassengers,
        totalReservations: totals.totalReservations,
        activeReservations: totals.activeReservations,
        cancelledReservations: totals.cancelledReservations,
        uniqueBookedPassengers: totals.uniqueBookedPassengers,
        utilizationPercent: totals.utilizationPercent
      },
      dailyReservations,
      topLines
    };
  }

  async getOccupancy(
    auth: AccessTokenPayload,
    query: ReportingOccupancyQueryDto
  ): Promise<ReportingOccupancyResponseDto> {
    const range = this.resolveDateRange(query.fromDate, query.toDate);
    const reservationRows = await this.getReservationAnalyticsRows(auth.tenantId, range, query.lineId);
    const grouped = this.groupByDateAndLine(reservationRows);

    const points = Array.from(grouped.values())
      .sort((a, b) => {
        if (a.date === b.date) {
          return a.lineName.localeCompare(b.lineName);
        }

        return a.date.localeCompare(b.date);
      })
      .map((item) => ({
        date: item.date,
        lineId: item.lineId,
        lineName: item.lineName,
        activeReservations: item.activeReservations,
        cancelledReservations: item.cancelledReservations,
        totalCapacity: item.totalCapacity,
        utilizationPercent: this.asPercent(item.activeReservations, item.totalCapacity)
      }));

    const totalActiveReservations = points.reduce((acc, point) => acc + point.activeReservations, 0);
    const totalCapacity = points.reduce((acc, point) => acc + point.totalCapacity, 0);

    return {
      range: {
        fromDate: range.fromDateIso,
        toDate: range.toDateIso
      },
      lineId: query.lineId ?? null,
      summary: {
        totalActiveReservations,
        totalCapacity,
        overallUtilizationPercent: this.asPercent(totalActiveReservations, totalCapacity)
      },
      points
    };
  }

  async getAudit(auth: AccessTokenPayload, query: ReportingAuditQueryDto): Promise<ReportingAuditResponseDto> {
    const range = this.resolveDateRange(query.fromDate, query.toDate);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    const records = await this.getAuditRecords(auth.tenantId, range, query.entity);

    const filtered = records
      .filter((item) => (query.actorUserId ? item.actorUserId === query.actorUserId : true))
      .sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime());

    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return {
      entity: query.entity ?? null,
      actorUserId: query.actorUserId ?? null,
      range: {
        fromDate: range.fromDateIso,
        toDate: range.toDateIso
      },
      page,
      pageSize,
      total: filtered.length,
      items
    };
  }

  private async getReservationAnalyticsRows(
    tenantId: string,
    range: DateRange,
    lineId?: string
  ): Promise<ReservationAnalyticsRow[]> {
    return this.prisma.reservation.findMany({
      where: {
        tenantId,
        travelDate: {
          gte: range.fromDate,
          lte: range.toDate
        },
        ...(lineId ? { ride: { lineId } } : {})
      },
      select: {
        travelDate: true,
        rideId: true,
        rideDepartureTime: true,
        status: true,
        passengerId: true,
        ride: {
          select: {
            capacity: true,
            line: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });
  }

  private buildReservationTotals(rows: ReservationAnalyticsRow[]): {
    totalReservations: number;
    activeReservations: number;
    cancelledReservations: number;
    uniqueBookedPassengers: number;
    utilizationPercent: number;
  } {
    let activeReservations = 0;
    let cancelledReservations = 0;
    let totalCapacity = 0;

    const passengers = new Set<string>();
    const instanceSeen = new Set<string>();

    rows.forEach((row) => {
      passengers.add(row.passengerId);

      if (row.status === ReservationStatus.ACTIVE) {
        activeReservations += 1;
      } else if (row.status === ReservationStatus.CANCELLED) {
        cancelledReservations += 1;
      }

      const dateKey = this.toDateOnly(row.travelDate);
      const instanceKey = `${row.rideId}:${dateKey}:${row.rideDepartureTime}`;

      if (!instanceSeen.has(instanceKey)) {
        instanceSeen.add(instanceKey);
        totalCapacity += row.ride.capacity;
      }
    });

    return {
      totalReservations: rows.length,
      activeReservations,
      cancelledReservations,
      uniqueBookedPassengers: passengers.size,
      utilizationPercent: this.asPercent(activeReservations, totalCapacity)
    };
  }

  private buildDailyReservationPoints(rows: ReservationAnalyticsRow[]): DailyReservationPointResponseDto[] {
    const dailyMap = new Map<
      string,
      { totalReservations: number; activeReservations: number; cancelledReservations: number }
    >();

    rows.forEach((row) => {
      const date = this.toDateOnly(row.travelDate);
      const current =
        dailyMap.get(date) ?? { totalReservations: 0, activeReservations: 0, cancelledReservations: 0 };

      current.totalReservations += 1;
      if (row.status === ReservationStatus.ACTIVE) {
        current.activeReservations += 1;
      } else if (row.status === ReservationStatus.CANCELLED) {
        current.cancelledReservations += 1;
      }

      dailyMap.set(date, current);
    });

    return Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({
        date,
        totalReservations: value.totalReservations,
        activeReservations: value.activeReservations,
        cancelledReservations: value.cancelledReservations
      }));
  }

  private buildTopLines(rows: ReservationAnalyticsRow[], limit: number): TopLineMetricResponseDto[] {
    const topLineMap = new Map<
      string,
      {
        lineId: string;
        lineName: string;
        totalReservations: number;
        activeReservations: number;
        cancelledReservations: number;
        totalCapacity: number;
        instanceSeen: Set<string>;
      }
    >();

    rows.forEach((row) => {
      const lineId = row.ride.line.id;
      const lineName = row.ride.line.name;

      const current =
        topLineMap.get(lineId) ?? {
          lineId,
          lineName,
          totalReservations: 0,
          activeReservations: 0,
          cancelledReservations: 0,
          totalCapacity: 0,
          instanceSeen: new Set<string>()
        };

      current.totalReservations += 1;
      if (row.status === ReservationStatus.ACTIVE) {
        current.activeReservations += 1;
      } else if (row.status === ReservationStatus.CANCELLED) {
        current.cancelledReservations += 1;
      }

      const dateKey = this.toDateOnly(row.travelDate);
      const instanceKey = `${row.rideId}:${dateKey}:${row.rideDepartureTime}`;
      if (!current.instanceSeen.has(instanceKey)) {
        current.instanceSeen.add(instanceKey);
        current.totalCapacity += row.ride.capacity;
      }

      topLineMap.set(lineId, current);
    });

    return Array.from(topLineMap.values())
      .sort((a, b) => b.activeReservations - a.activeReservations)
      .slice(0, limit)
      .map((item) => ({
        lineId: item.lineId,
        lineName: item.lineName,
        totalReservations: item.totalReservations,
        activeReservations: item.activeReservations,
        cancelledReservations: item.cancelledReservations,
        uniqueRideInstances: item.instanceSeen.size,
        utilizationPercent: this.asPercent(item.activeReservations, item.totalCapacity)
      }));
  }

  private groupByDateAndLine(rows: ReservationAnalyticsRow[]):
    Map<
      string,
      {
        date: string;
        lineId: string;
        lineName: string;
        activeReservations: number;
        cancelledReservations: number;
        totalCapacity: number;
        instanceSeen: Set<string>;
      }
    > {
    const map = new Map<
      string,
      {
        date: string;
        lineId: string;
        lineName: string;
        activeReservations: number;
        cancelledReservations: number;
        totalCapacity: number;
        instanceSeen: Set<string>;
      }
    >();

    rows.forEach((row) => {
      const date = this.toDateOnly(row.travelDate);
      const lineId = row.ride.line.id;
      const key = `${date}:${lineId}`;

      const current =
        map.get(key) ?? {
          date,
          lineId,
          lineName: row.ride.line.name,
          activeReservations: 0,
          cancelledReservations: 0,
          totalCapacity: 0,
          instanceSeen: new Set<string>()
        };

      if (row.status === ReservationStatus.ACTIVE) {
        current.activeReservations += 1;
      } else if (row.status === ReservationStatus.CANCELLED) {
        current.cancelledReservations += 1;
      }

      const instanceKey = `${row.rideId}:${date}:${row.rideDepartureTime}`;
      if (!current.instanceSeen.has(instanceKey)) {
        current.instanceSeen.add(instanceKey);
        current.totalCapacity += row.ride.capacity;
      }

      map.set(key, current);
    });

    return map;
  }

  private async getAuditRecords(
    tenantId: string,
    range: DateRange,
    entity?: AuditEntity
  ): Promise<AuditItemResponseDto[]> {
    const entities = entity
      ? [entity]
      : [
          AuditEntity.USERS,
          AuditEntity.STATIONS,
          AuditEntity.LINES,
          AuditEntity.PASSENGERS,
          AuditEntity.RIDES,
          AuditEntity.RESERVATIONS
        ];

    const loaders = entities.map((auditEntity) => this.loadAuditByEntity(tenantId, range, auditEntity));
    const loaded = await Promise.all(loaders);
    return loaded.flat();
  }

  private async loadAuditByEntity(
    tenantId: string,
    range: DateRange,
    entity: AuditEntity
  ): Promise<AuditItemResponseDto[]> {
    const where = {
      tenantId,
      updatedAt: {
        gte: range.fromDate,
        lte: range.toDate
      }
    };

    let rows: AuditBaseRow[] = [];

    switch (entity) {
      case AuditEntity.USERS:
        rows = await this.prisma.user.findMany({
          where,
          select: this.auditSelect
        });
        break;
      case AuditEntity.STATIONS:
        rows = await this.prisma.station.findMany({
          where,
          select: this.auditSelect
        });
        break;
      case AuditEntity.LINES:
        rows = await this.prisma.line.findMany({
          where,
          select: this.auditSelect
        });
        break;
      case AuditEntity.PASSENGERS:
        rows = await this.prisma.passenger.findMany({
          where,
          select: this.auditSelect
        });
        break;
      case AuditEntity.RIDES:
        rows = await this.prisma.ride.findMany({
          where,
          select: this.auditSelect
        });
        break;
      case AuditEntity.RESERVATIONS:
        rows = await this.prisma.reservation.findMany({
          where,
          select: this.auditSelect
        });
        break;
      default:
        rows = [];
        break;
    }

    return rows.map((row) => ({
      entity,
      entityId: row.id,
      action: row.createdAt.getTime() === row.updatedAt.getTime() ? 'CREATED' : 'UPDATED',
      actorUserId: row.updatedById ?? row.createdById,
      createdById: row.createdById,
      updatedById: row.updatedById,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      changedAt: row.updatedAt
    }));
  }

  private readonly auditSelect = {
    id: true,
    createdById: true,
    updatedById: true,
    createdAt: true,
    updatedAt: true
  };

  private resolveDateRange(fromDate?: string, toDate?: string): DateRange {
    const now = new Date();
    const end = toDate ? this.toUtcDate(toDate) : this.toUtcDate(this.toDateOnly(now));

    const startDefault = new Date(end);
    startDefault.setUTCDate(startDefault.getUTCDate() - 29);

    const start = fromDate ? this.toUtcDate(fromDate) : startDefault;

    if (start.getTime() > end.getTime()) {
      throw new BadRequestException('fromDate cannot be after toDate');
    }

    return {
      fromDate: start,
      toDate: end,
      fromDateIso: this.toDateOnly(start),
      toDateIso: this.toDateOnly(end)
    };
  }

  private toUtcDate(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private toDateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private asPercent(value: number, base: number): number {
    if (base <= 0) {
      return 0;
    }

    return Number(((value / base) * 100).toFixed(2));
  }
}
