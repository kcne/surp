import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RideStatus, StorefrontStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  PublicAgencyStorefrontResponseDto,
  PublicStorefrontRideSummaryDto
} from '../storefront/dto/storefront.response.dto';
import { STOREFRONT_SELECT, mapStorefrontToPublicDto } from '../storefront/storefront.mapper';

const PUBLIC_RIDE_SELECT = Prisma.validator<Prisma.RideSelect>()({
  id: true,
  name: true,
  type: true,
  oneTimeDate: true,
  oneTimeDepartureTime: true,
  line: {
    select: {
      name: true,
      isActive: true,
      departureStation: {
        select: {
          name: true
        }
      },
      arrivalStation: {
        select: {
          name: true
        }
      }
    }
  },
  daySchedules: {
    select: {
      dayOfWeek: true,
      stationTimes: {
        select: {
          orderIndex: true,
          time: true
        },
        orderBy: {
          orderIndex: 'asc' as const
        }
      }
    },
    orderBy: {
      dayOfWeek: 'asc' as const
    }
  }
});

type PublicRideRecord = Prisma.RideGetPayload<{ select: typeof PUBLIC_RIDE_SELECT }>;

@Injectable()
export class PublicStorefrontService {
  constructor(private readonly prisma: PrismaService) {}

  async getAgencyBySlug(slug: string): Promise<PublicAgencyStorefrontResponseDto> {
    const normalizedSlug = slug.trim().toLowerCase();
    const storefront = await this.prisma.agencyStorefront.findFirst({
      where: {
        status: StorefrontStatus.PUBLISHED,
        tenant: {
          slug: normalizedSlug,
          isActive: true
        }
      },
      select: STOREFRONT_SELECT
    });

    if (!storefront) {
      throw new NotFoundException('Agency storefront not found');
    }

    const rides = await this.getPublicRideSummaries(storefront.tenantId);

    return mapStorefrontToPublicDto(storefront, rides);
  }

  private async getPublicRideSummaries(tenantId: string): Promise<PublicStorefrontRideSummaryDto[]> {
    const rides = await this.prisma.ride.findMany({
      where: {
        tenantId,
        status: RideStatus.ACTIVE,
        line: {
          isActive: true
        }
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 6,
      select: PUBLIC_RIDE_SELECT
    });

    return rides
      .map((ride) => this.toPublicRideSummary(ride))
      .filter((ride): ride is PublicStorefrontRideSummaryDto => ride !== null);
  }

  private toPublicRideSummary(ride: PublicRideRecord): PublicStorefrontRideSummaryDto | null {
    const departureTimes = this.getDepartureTimes(ride);

    if (departureTimes.length === 0) {
      return null;
    }

    return {
      id: ride.id,
      lineName: ride.line.name || ride.name,
      origin: ride.line.departureStation.name,
      destination: ride.line.arrivalStation.name,
      departureTimes,
      days: this.formatRideDays(ride)
    };
  }

  private getDepartureTimes(ride: PublicRideRecord): string[] {
    const times =
      ride.oneTimeDepartureTime !== null
        ? [ride.oneTimeDepartureTime]
        : ride.daySchedules
            .map((schedule) => schedule.stationTimes.find((time) => time.orderIndex === 0)?.time)
            .filter((time): time is string => Boolean(time));

    return Array.from(new Set(times)).slice(0, 3);
  }

  private formatRideDays(ride: PublicRideRecord): string {
    if (ride.oneTimeDate) {
      return ride.oneTimeDate.toISOString().slice(0, 10);
    }

    const days = ride.daySchedules.map((schedule) => schedule.dayOfWeek).sort((a, b) => a - b);

    if (days.length === 7) {
      return 'Svaki dan';
    }

    if (days.join(',') === '1,2,3,4,5') {
      return 'Pon-Pet';
    }

    if (days.join(',') === '1,2,3,4,5,6') {
      return 'Pon-Sub';
    }

    const labels = ['Ned', 'Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub'];
    return days.map((day) => labels[day] ?? String(day)).join(', ');
  }
}
