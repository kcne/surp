import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DepartureSource, Prisma, ReservationStatus } from '@prisma/client';
import { AccessTokenPayload } from '../auth/auth.types';
import { consentFrom } from '../invariants/dto/confirm-breaking-change.dto';
import {
  NO_CONSENT,
  PROSPECTIVE_INVARIANTS,
  guardProspectiveWrite
} from '../invariants/prospective-write';
import { PrismaService } from '../prisma/prisma.service';
import {
  OperatedDeparture,
  assertDecisionDate,
  assertOperable,
  cancelDeparture,
  createExtra,
  deleteExtra,
  loadOperatedDeparture,
  restoreDeparture,
  updateExtra
} from './departure-operations';
import { DepartureListResponseDto, DepartureResponseDto } from './dto/departure.response.dto';
import {
  CancelDepartureDto,
  CreateExtraDepartureDto,
  UpdateExtraDepartureDto
} from './dto/departure-operations.dto';
import { ListDeparturesQueryDto } from './dto/list-departures.query.dto';

/**
 * Stored departures, read as they are (#27, PR 3c), and the operator's
 * decisions on them (PR 3d). Past, cancelled, dropped and `LEGACY` departures
 * are all returned: the reader decides what to show.
 *
 * Every operation is a schedule edit: it runs under the tenant's exclusive
 * schedule lock, so no booking is in flight while it decides. None of them
 * changes the timetable, so none runs the departure sync.
 */

/** The longest range one list request covers, both ends counted. */
export const DEPARTURE_LIST_MAX_DAYS = 62;

/**
 * The range for cancelled departures only: the agency's today to +365, in one
 * request. What comes back is bounded by operator decisions, not by the
 * timetable, so the 62-day cap on a full read is not needed.
 */
export const CANCELLED_DEPARTURE_LIST_MAX_DAYS = 366;

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
  _count: { select: { reservations: { where: { status: ReservationStatus.ACTIVE } } } },
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

/**
 * A `YYYY-MM-DD` string as a UTC midnight, or null when it is no real date.
 * Year 0000 is refused too: JavaScript accepts it, Postgres has no year 0.
 */
function parseDate(value: string): Date | null {
  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() < 1 ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
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

    const cancelledOnly = query.cancelled === 'true';
    const maxDays = cancelledOnly ? CANCELLED_DEPARTURE_LIST_MAX_DAYS : DEPARTURE_LIST_MAX_DAYS;

    if ((to.getTime() - from.getTime()) / DAY_MS + 1 > maxDays) {
      throw new BadRequestException(`A range covers at most ${maxDays} days`);
    }

    const rows = await this.prisma.departure.findMany({
      where: {
        tenantId: auth.tenantId,
        serviceDate: { gte: from, lte: to },
        ...(query.rideId ? { rideId: query.rideId } : {}),
        ...(query.lineId ? { lineId: query.lineId } : {}),
        ...(cancelledOnly
          ? { cancelledAt: { not: null }, source: { not: DepartureSource.LEGACY } }
          : {})
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

  /**
   * Cancels a departure. Its passengers stay `ACTIVE`; when it has any, the
   * write is refused until the operator confirms the list they were shown.
   */
  async cancel(
    auth: AccessTokenPayload,
    id: string,
    dto: CancelDepartureDto
  ): Promise<DepartureResponseDto> {
    await guardProspectiveWrite<void, OperatedDeparture>(
      this.prisma,
      scopeOf(auth),
      PROSPECTIVE_INVARIANTS.departureCancel,
      consentFrom(dto),
      (tx, departure) => cancelDeparture(tx, departure, auth.sub),
      (tx) => this.prepare(tx, auth, id, 'cancel')
    );

    return this.getById(auth, id);
  }

  async restore(auth: AccessTokenPayload, id: string): Promise<DepartureResponseDto> {
    await guardProspectiveWrite<void, OperatedDeparture>(
      this.prisma,
      scopeOf(auth),
      [],
      NO_CONSENT,
      (tx, departure) => restoreDeparture(tx, departure, auth.sub),
      (tx) => this.prepare(tx, auth, id, 'restore')
    );

    return this.getById(auth, id);
  }

  async createExtra(
    auth: AccessTokenPayload,
    dto: CreateExtraDepartureDto
  ): Promise<DepartureResponseDto> {
    const serviceDate = parseDate(dto.serviceDate);

    if (!serviceDate) {
      throw new BadRequestException('serviceDate must be a real date');
    }

    const { departureId } = await guardProspectiveWrite(
      this.prisma,
      scopeOf(auth),
      [],
      NO_CONSENT,
      (tx) =>
        createExtra(
          tx,
          { tenantId: auth.tenantId, rideId: dto.rideId, actorId: auth.sub },
          {
            serviceDate,
            departureTime: dto.departureTime,
            arrivalTime: dto.arrivalTime,
            capacity: dto.capacity
          }
        ),
      async (tx) => {
        const ride = await tx.ride.findFirst({
          where: { id: dto.rideId, tenantId: auth.tenantId },
          select: { id: true }
        });

        if (!ride) {
          throw new NotFoundException('Ride not found');
        }

        await assertDecisionDate(tx, auth.tenantId, serviceDate);
      }
    );

    return this.getById(auth, departureId);
  }

  /**
   * Moves an extra bus or changes its seats. Asks before a booked bus moves,
   * or shrinks under a booked seat or a full stretch of the route.
   */
  async updateExtra(
    auth: AccessTokenPayload,
    id: string,
    dto: UpdateExtraDepartureDto
  ): Promise<DepartureResponseDto> {
    if (dto.departureTime === undefined && dto.arrivalTime === undefined && dto.capacity === undefined) {
      throw new BadRequestException('Send departureTime, arrivalTime or capacity');
    }

    await guardProspectiveWrite<void, OperatedDeparture>(
      this.prisma,
      scopeOf(auth),
      PROSPECTIVE_INVARIANTS.extraUpdate,
      consentFrom(dto),
      (tx, departure) =>
        updateExtra(tx, departure, auth.sub, {
          departureTime: dto.departureTime,
          arrivalTime: dto.arrivalTime,
          capacity: dto.capacity
        }),
      (tx) => this.prepare(tx, auth, id, 'editExtra')
    );

    return this.getById(auth, id);
  }

  /** Deletes an extra bus nobody was booked on, and answers with it as it was. */
  async deleteExtra(auth: AccessTokenPayload, id: string): Promise<DepartureResponseDto> {
    return guardProspectiveWrite<DepartureResponseDto, OperatedDeparture>(
      this.prisma,
      scopeOf(auth),
      [],
      NO_CONSENT,
      async (tx, departure) => {
        const row = await tx.departure.findUniqueOrThrow({
          where: { id: departure.id },
          select: DEPARTURE_SELECT
        });

        await deleteExtra(tx, departure);

        return toResponse(row);
      },
      (tx) => this.prepare(tx, auth, id, 'deleteExtra')
    );
  }

  /**
   * Reads the departure under the lock and refuses, before the tenant-wide
   * scan, an operation that does not apply to it or a date outside today to
   * the horizon.
   */
  private async prepare(
    tx: Prisma.TransactionClient,
    auth: AccessTokenPayload,
    id: string,
    operation: Parameters<typeof assertOperable>[1]
  ): Promise<OperatedDeparture> {
    const departure = await loadOperatedDeparture(tx, auth.tenantId, id);

    assertOperable(departure, operation);
    await assertDecisionDate(tx, auth.tenantId, departure.serviceDate);

    return departure;
  }
}

function scopeOf(auth: AccessTokenPayload) {
  return { tenantId: auth.tenantId, actorId: auth.sub, changesTimetable: false };
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
    activeReservationCount: row._count.reservations,
    availableSeats: Math.max(row.capacity - row._count.reservations, 0),
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
