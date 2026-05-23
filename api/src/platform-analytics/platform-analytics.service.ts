import { BadRequestException, Injectable } from '@nestjs/common';
import { MarketingLeadStatus, RideStatus, StorefrontStatus, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformAnalyticsQueryDto } from './dto/platform-analytics.query.dto';
import {
  PlatformAnalyticsResponseDto,
  PlatformDailyTrendPointDto,
  PlatformTopAgencyDto
} from './dto/platform-analytics.response.dto';

type DateRange = {
  fromDate: Date;
  toDate: Date;
  toDateEnd: Date;
  fromDateIso: string;
  toDateIso: string;
};

const PLATFORM_TENANT_SLUG = 'platform';

@Injectable()
export class PlatformAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(query: PlatformAnalyticsQueryDto): Promise<PlatformAnalyticsResponseDto> {
    const range = this.resolveDateRange(query.fromDate, query.toDate);
    const topAgenciesLimit = query.topAgenciesLimit ?? 5;

    const [
      totalAgencies,
      activeAgencies,
      totalUsers,
      activeUsers,
      reservations,
      activeRides,
      activeLines,
      totalPassengers,
      openTickets,
      leadsInPeriod,
      convertedLeadsInPeriod,
      publishedStorefronts,
      agenciesWithRecentActivity,
      topAgencies
    ] = await Promise.all([
      this.prisma.tenant.count({ where: { slug: { not: PLATFORM_TENANT_SLUG } } }),
      this.prisma.tenant.count({ where: { slug: { not: PLATFORM_TENANT_SLUG }, isActive: true } }),
      this.prisma.user.count({ where: { tenant: { slug: { not: PLATFORM_TENANT_SLUG } } } }),
      this.prisma.user.count({
        where: { isActive: true, tenant: { slug: { not: PLATFORM_TENANT_SLUG } } }
      }),
      this.prisma.reservation.findMany({
        where: {
          travelDate: {
            gte: range.fromDate,
            lte: range.toDate
          }
        },
        select: {
          tenantId: true,
          travelDate: true,
          tenant: {
            select: {
              id: true,
              slug: true,
              name: true
            }
          }
        }
      }),
      this.prisma.ride.count({
        where: { status: RideStatus.ACTIVE, tenant: { slug: { not: PLATFORM_TENANT_SLUG } } }
      }),
      this.prisma.line.count({
        where: { isActive: true, tenant: { slug: { not: PLATFORM_TENANT_SLUG } } }
      }),
      this.prisma.passenger.count({ where: { tenant: { slug: { not: PLATFORM_TENANT_SLUG } } } }),
      this.prisma.ticket.count({ where: { status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] } } }),
      this.prisma.marketingLead.findMany({
        where: {
          createdAt: {
            gte: range.fromDate,
            lte: range.toDateEnd
          }
        },
        select: {
          createdAt: true
        }
      }),
      this.prisma.marketingLead.count({
        where: {
          status: MarketingLeadStatus.CONVERTED,
          convertedAt: {
            gte: range.fromDate,
            lte: range.toDateEnd
          }
        }
      }),
      this.prisma.agencyStorefront.count({ where: { status: StorefrontStatus.PUBLISHED } }),
      this.countAgenciesWithRecentActivity(range),
      this.buildTopAgencies(range, topAgenciesLimit)
    ]);

    return {
      range: {
        fromDate: range.fromDateIso,
        toDate: range.toDateIso
      },
      summary: {
        totalAgencies,
        activeAgencies,
        totalUsers,
        activeUsers,
        reservationsInPeriod: reservations.length,
        activeRides,
        activeLines,
        totalPassengers,
        openTickets,
        newLeadsInPeriod: leadsInPeriod.length,
        convertedLeadsInPeriod,
        leadConversionRatePercent: this.asPercent(convertedLeadsInPeriod, leadsInPeriod.length),
        publishedStorefronts,
        agenciesWithRecentActivity
      },
      dailyTrend: this.buildDailyTrend(range, reservations, leadsInPeriod),
      topAgencies
    };
  }

  private async buildTopAgencies(range: DateRange, limit: number): Promise<PlatformTopAgencyDto[]> {
    const reservations = await this.prisma.reservation.findMany({
      where: {
        travelDate: {
          gte: range.fromDate,
          lte: range.toDate
        }
      },
      select: {
        tenantId: true,
        tenant: {
          select: {
            id: true,
            slug: true,
            name: true
          }
        }
      }
    });

    const grouped = new Map<
      string,
      { tenantId: string; tenantSlug: string; tenantName: string; reservationsInPeriod: number }
    >();

    reservations.forEach((reservation) => {
      const current =
        grouped.get(reservation.tenantId) ??
        {
          tenantId: reservation.tenant.id,
          tenantSlug: reservation.tenant.slug,
          tenantName: reservation.tenant.name,
          reservationsInPeriod: 0
        };

      current.reservationsInPeriod += 1;
      grouped.set(reservation.tenantId, current);
    });

    const top = Array.from(grouped.values())
      .sort((a, b) => b.reservationsInPeriod - a.reservationsInPeriod)
      .slice(0, limit);

    return Promise.all(
      top.map(async (agency) => {
        const [activeUsers, activeRides, activeLines] = await Promise.all([
          this.prisma.user.count({ where: { tenantId: agency.tenantId, isActive: true } }),
          this.prisma.ride.count({ where: { tenantId: agency.tenantId, status: RideStatus.ACTIVE } }),
          this.prisma.line.count({ where: { tenantId: agency.tenantId, isActive: true } })
        ]);

        return {
          ...agency,
          activeUsers,
          activeRides,
          activeLines
        };
      })
    );
  }

  private buildDailyTrend(
    range: DateRange,
    reservations: Array<{ travelDate: Date }>,
    leads: Array<{ createdAt: Date }>
  ): PlatformDailyTrendPointDto[] {
    const points = new Map<string, PlatformDailyTrendPointDto>();
    const cursor = new Date(range.fromDate);

    while (cursor.getTime() <= range.toDate.getTime()) {
      const date = this.toDateOnly(cursor);
      points.set(date, {
        date,
        reservations: 0,
        leads: 0
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    reservations.forEach((reservation) => {
      const date = this.toDateOnly(reservation.travelDate);
      const point = points.get(date);
      if (point) {
        point.reservations += 1;
      }
    });

    leads.forEach((lead) => {
      const date = this.toDateOnly(lead.createdAt);
      const point = points.get(date);
      if (point) {
        point.leads += 1;
      }
    });

    return Array.from(points.values());
  }

  private async countAgenciesWithRecentActivity(range: DateRange): Promise<number> {
    const rows = await this.prisma.reservation.findMany({
      where: {
        createdAt: {
          gte: range.fromDate,
          lte: range.toDateEnd
        }
      },
      select: {
        tenantId: true
      },
      distinct: ['tenantId']
    });

    return rows.length;
  }

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
      toDateEnd: this.toUtcDateEnd(this.toDateOnly(end)),
      fromDateIso: this.toDateOnly(start),
      toDateIso: this.toDateOnly(end)
    };
  }

  private toUtcDate(value: string): Date {
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }

  private toUtcDateEnd(value: string): Date {
    return new Date(`${value.slice(0, 10)}T23:59:59.999Z`);
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
