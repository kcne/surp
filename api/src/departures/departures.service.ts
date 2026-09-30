import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccessTokenPayload } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { DepartureListResponseDto, DepartureResponseDto } from './dto/departure.response.dto';
import { ListDeparturesQueryDto } from './dto/list-departures.query.dto';

/**
 * Stored departures, read as they are (#27, PR 3c). Past, cancelled, dropped
 * and `LEGACY` departures are all returned: the reader decides what to show.
 */

/** The longest range one list request covers, both ends counted. */
export const DEPARTURE_LIST_MAX_DAYS = 62;

const DEPARTURE_SELECT = {
  id: true,
  rideId: true,
  lineId: true,
  serviceDate: true,
  source: true,
  departureTime: true,
  arrivalTime: true,
  capacity: true,
  timetableDroppedAt: true,
  cancelledAt: true,
  cancelledById: true,
  createdAt: true,
  updatedAt: true,
  ride: { select: { name: true } },
  line: { select: { name: true } },
  stops: {
    select: {
      stationId: true,
      orderIndex: true,
      time: true,
      isBoarding: true,
      isDropoff: true,
      station: { select: { name: true } }
    },
    orderBy: { orderIndex: 'asc' }
  }
} as const satisfies Prisma.DepartureSelect;

type DepartureRow = Prisma.DepartureGetPayload<{ select: typeof DEPARTURE_SELECT }>;

/** A `YYYY-MM-DD` string as a UTC midnight, or null when it is no real date. */
function parseDate(value: string): Date | null {
  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return null;
  }

  return parsed;
}

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class DeparturesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(auth: AccessTokenPayload, query: ListDeparturesQueryDto): Promise<DepartureListResponseDto> {
    const from = parseDate(query.from);
    const to = parseDate(query.to);

    if (!from || !to) {
      throw new BadRequestException('from and to must be real dates');
    }

    if (to < from) {
      throw new BadRequestException('to must not be before from');
    }

    if ((to.getTime() - from.getTime()) / DAY_MS + 1 > DEPARTURE_LIST_MAX_DAYS) {
      throw new BadRequestException(`A range covers at most ${DEPARTURE_LIST_MAX_DAYS} days`);
    }

    const rows = await this.prisma.departure.findMany({
      where: {
        tenantId: auth.tenantId,
        serviceDate: { gte: from, lte: to },
        ...(query.rideId ? { rideId: query.rideId } : {}),
        ...(query.lineId ? { lineId: query.lineId } : {})
      },
      select: DEPARTURE_SELECT,
      orderBy: [{ serviceDate: 'asc' }, { departureTime: 'asc' }, { id: 'asc' }]
    });

    return { from: query.from, to: query.to, items: rows.map(toResponse) };
  }

  async getById(auth: AccessTokenPayload, id: string): Promise<DepartureResponseDto> {
    const row = await this.prisma.departure.findFirst({
      where: { id, tenantId: auth.tenantId },
      select: DEPARTURE_SELECT
    });

    if (!row) {
      throw new NotFoundException('Departure not found');
    }

    return toResponse(row);
  }
}

function toResponse(row: DepartureRow): DepartureResponseDto {
  return {
    id: row.id,
    rideId: row.rideId,
    rideName: row.ride.name,
    lineId: row.lineId,
    lineName: row.line.name,
    serviceDate: row.serviceDate.toISOString().slice(0, 10),
    source: row.source,
    departureTime: row.departureTime,
    arrivalTime: row.arrivalTime,
    capacity: row.capacity,
    timetableDroppedAt: row.timetableDroppedAt,
    cancelledAt: row.cancelledAt,
    cancelledById: row.cancelledById,
    stops: row.stops.map((stop) => ({
      stationId: stop.stationId,
      stationName: stop.station.name,
      orderIndex: stop.orderIndex,
      time: stop.time,
      isBoarding: stop.isBoarding,
      isDropoff: stop.isDropoff
    })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
