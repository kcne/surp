import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma, ReservationStatus } from '@prisma/client';
import { AccessTokenPayload } from '../auth/auth.types';
import { withCreateAudit, withUpdateAudit } from '../prisma/audit-write.helper';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, resolvePagination } from '../prisma/repository-helpers';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ListReservationsQueryDto } from './dto/list-reservations.query.dto';
import {
  PaginatedReservationsResponseDto,
  ReservationResponseDto
} from './dto/reservation.response.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';

const SAFE_RESERVATION_SELECT = Prisma.validator<Prisma.ReservationSelect>()({
  id: true,
  tenantId: true,
  rideId: true,
  passengerId: true,
  createdById: true,
  updatedById: true,
  travelDate: true,
  rideDepartureTime: true,
  rideArrivalTime: true,
  seatNumber: true,
  status: true,
  cancelledAt: true,
  departureStationId: true,
  arrivalStationId: true,
  createdAt: true,
  updatedAt: true,
  ride: {
    select: {
      id: true,
      name: true,
      lineId: true
    }
  },
  passenger: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true
    }
  },
  departureStation: {
    select: {
      id: true,
      name: true
    }
  },
  arrivalStation: {
    select: {
      id: true,
      name: true
    }
  }
});

type SelectedReservation = Prisma.ReservationGetPayload<{ select: typeof SAFE_RESERVATION_SELECT }>;

type RideRouteContext = {
  rideId: string;
  stationOrderById: Map<string, number>;
};

type RouteSegment = {
  departureOrder: number;
  arrivalOrder: number;
};

@Injectable()
export class ReservationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(auth: AccessTokenPayload, dto: CreateReservationDto): Promise<ReservationResponseDto> {
    const rideContext = await this.getRideRouteContext(auth.tenantId, dto.rideId);
    await this.ensurePassengerExistsInTenant(auth.tenantId, dto.passengerId);

    const segment = this.validateAndResolveSegment(
      rideContext.stationOrderById,
      dto.departureStationId,
      dto.arrivalStationId
    );

    const travelDate = this.toUtcDate(dto.travelDate);

    await this.ensureSeatIsAvailable({
      tenantId: auth.tenantId,
      rideId: dto.rideId,
      travelDate,
      rideDepartureTime: dto.rideDepartureTime,
      seatNumber: dto.seatNumber,
      segment,
      stationOrderById: rideContext.stationOrderById
    });

    const created = await this.prisma.reservation.create({
      data: withCreateAudit(
        {
          tenantId: auth.tenantId,
          rideId: dto.rideId,
          passengerId: dto.passengerId,
          travelDate,
          rideDepartureTime: dto.rideDepartureTime,
          rideArrivalTime: dto.rideArrivalTime,
          seatNumber: dto.seatNumber,
          departureStationId: dto.departureStationId,
          arrivalStationId: dto.arrivalStationId,
          status: ReservationStatus.ACTIVE,
          cancelledAt: null
        },
        auth.sub
      ),
      select: SAFE_RESERVATION_SELECT
    });

    return this.toResponse(created);
  }

  async list(
    auth: AccessTokenPayload,
    query: ListReservationsQueryDto
  ): Promise<PaginatedReservationsResponseDto> {
    const pagination = resolvePagination(query.page, query.pageSize);

    const where = {
      tenantId: auth.tenantId,
      ...(query.rideId ? { rideId: query.rideId } : {}),
      ...(query.passengerId ? { passengerId: query.passengerId } : {}),
      ...(query.travelDate ? { travelDate: this.toUtcDate(query.travelDate) } : {}),
      ...(query.rideDepartureTime ? { rideDepartureTime: query.rideDepartureTime } : {}),
      ...(query.status ? { status: query.status } : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.reservation.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ createdAt: 'desc' }],
        select: SAFE_RESERVATION_SELECT
      }),
      this.prisma.reservation.count({ where })
    ]);

    return {
      items: items.map((item) => this.toResponse(item)),
      total,
      page: pagination.page ?? DEFAULT_PAGE,
      pageSize: pagination.pageSize ?? DEFAULT_PAGE_SIZE
    };
  }

  async getById(auth: AccessTokenPayload, id: string): Promise<ReservationResponseDto> {
    const reservation = await this.getReservationOrThrow(auth.tenantId, id);
    return this.toResponse(reservation);
  }

  async update(
    auth: AccessTokenPayload,
    id: string,
    dto: UpdateReservationDto
  ): Promise<ReservationResponseDto> {
    const existing = await this.getReservationOrThrow(auth.tenantId, id);

    if (existing.status === ReservationStatus.CANCELLED) {
      throw new BadRequestException('Cancelled reservation cannot be updated');
    }

    const nextPassengerId = dto.passengerId ?? existing.passengerId;
    if (nextPassengerId !== existing.passengerId) {
      await this.ensurePassengerExistsInTenant(auth.tenantId, nextPassengerId);
    }

    const departureStationId = dto.departureStationId ?? existing.departureStationId;
    const arrivalStationId = dto.arrivalStationId ?? existing.arrivalStationId;
    const seatNumber = dto.seatNumber ?? existing.seatNumber;

    const rideContext = await this.getRideRouteContext(auth.tenantId, existing.rideId);
    const segment = this.validateAndResolveSegment(
      rideContext.stationOrderById,
      departureStationId,
      arrivalStationId
    );

    await this.ensureSeatIsAvailable({
      tenantId: auth.tenantId,
      rideId: existing.rideId,
      travelDate: existing.travelDate,
      rideDepartureTime: existing.rideDepartureTime,
      seatNumber,
      segment,
      stationOrderById: rideContext.stationOrderById,
      excludeReservationId: existing.id
    });

    const updated = await this.prisma.reservation.update({
      where: {
        id
      },
      data: withUpdateAudit(
        {
          ...(dto.passengerId ? { passengerId: dto.passengerId } : {}),
          ...(dto.seatNumber !== undefined ? { seatNumber: dto.seatNumber } : {}),
          ...(dto.departureStationId ? { departureStationId: dto.departureStationId } : {}),
          ...(dto.arrivalStationId ? { arrivalStationId: dto.arrivalStationId } : {})
        },
        auth.sub
      ),
      select: SAFE_RESERVATION_SELECT
    });

    return this.toResponse(updated);
  }

  async cancel(auth: AccessTokenPayload, id: string): Promise<ReservationResponseDto> {
    return this.softDelete(auth, id, false);
  }

  async softDelete(
    auth: AccessTokenPayload,
    id: string,
    strict: boolean = false
  ): Promise<ReservationResponseDto> {
    const existing = await this.getReservationOrThrow(auth.tenantId, id);

    if (existing.status === ReservationStatus.CANCELLED) {
      if (strict) {
        throw new BadRequestException('Reservation is already cancelled');
      }

      return this.toResponse(existing);
    }

    const cancelled = await this.prisma.reservation.update({
      where: {
        id
      },
      data: withUpdateAudit(
        {
          status: ReservationStatus.CANCELLED,
          cancelledAt: new Date()
        },
        auth.sub
      ),
      select: SAFE_RESERVATION_SELECT
    });

    return this.toResponse(cancelled);
  }

  private async getReservationOrThrow(
    tenantId: string,
    id: string
  ): Promise<SelectedReservation> {
    const reservation = await this.prisma.reservation.findFirst({
      where: {
        id,
        tenantId
      },
      select: SAFE_RESERVATION_SELECT
    });

    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    return reservation;
  }

  private async getRideRouteContext(tenantId: string, rideId: string): Promise<RideRouteContext> {
    const ride = await this.prisma.ride.findFirst({
      where: {
        id: rideId,
        tenantId
      },
      select: {
        id: true,
        line: {
          select: {
            departureStationId: true,
            arrivalStationId: true,
            intermediateStops: {
              select: {
                stationId: true,
                orderIndex: true
              },
              orderBy: {
                orderIndex: 'asc'
              }
            }
          }
        }
      }
    });

    if (!ride) {
      throw new BadRequestException('Ride must exist in the current tenant');
    }

    const stationOrderById = new Map<string, number>();
    stationOrderById.set(ride.line.departureStationId, 0);

    ride.line.intermediateStops.forEach((stop, index) => {
      stationOrderById.set(stop.stationId, index + 1);
    });

    stationOrderById.set(ride.line.arrivalStationId, ride.line.intermediateStops.length + 1);

    return {
      rideId: ride.id,
      stationOrderById
    };
  }

  private validateAndResolveSegment(
    stationOrderById: Map<string, number>,
    departureStationId: string,
    arrivalStationId: string
  ): RouteSegment {
    if (departureStationId === arrivalStationId) {
      throw new BadRequestException('Departure and arrival stations must be different');
    }

    const departureOrder = stationOrderById.get(departureStationId);
    const arrivalOrder = stationOrderById.get(arrivalStationId);

    if (departureOrder === undefined || arrivalOrder === undefined) {
      throw new BadRequestException('Departure and arrival stations must exist on the ride line path');
    }

    if (departureOrder >= arrivalOrder) {
      throw new BadRequestException('Departure station must come before arrival station on line path');
    }

    return {
      departureOrder,
      arrivalOrder
    };
  }

  private async ensurePassengerExistsInTenant(tenantId: string, passengerId: string): Promise<void> {
    const passenger = await this.prisma.passenger.findFirst({
      where: {
        id: passengerId,
        tenantId
      },
      select: {
        id: true
      }
    });

    if (!passenger) {
      throw new BadRequestException('Passenger must exist in the current tenant');
    }
  }

  private async ensureSeatIsAvailable(input: {
    tenantId: string;
    rideId: string;
    travelDate: Date;
    rideDepartureTime: string;
    seatNumber: number;
    segment: RouteSegment;
    stationOrderById: Map<string, number>;
    excludeReservationId?: string;
  }): Promise<void> {
    const existing = await this.prisma.reservation.findMany({
      where: {
        tenantId: input.tenantId,
        rideId: input.rideId,
        travelDate: input.travelDate,
        rideDepartureTime: input.rideDepartureTime,
        seatNumber: input.seatNumber,
        status: ReservationStatus.ACTIVE,
        ...(input.excludeReservationId
          ? {
              id: {
                not: input.excludeReservationId
              }
            }
          : {})
      },
      select: {
        id: true,
        departureStationId: true,
        arrivalStationId: true
      }
    });

    const hasOverlapConflict = existing.some((item) => {
      const departureOrder = input.stationOrderById.get(item.departureStationId);
      const arrivalOrder = input.stationOrderById.get(item.arrivalStationId);

      if (departureOrder === undefined || arrivalOrder === undefined) {
        return true;
      }

      return this.segmentsOverlap(
        {
          departureOrder,
          arrivalOrder
        },
        input.segment
      );
    });

    if (hasOverlapConflict) {
      throw new ConflictException('Seat is already booked for this route segment');
    }
  }

  private segmentsOverlap(a: RouteSegment, b: RouteSegment): boolean {
    return Math.max(a.departureOrder, b.departureOrder) < Math.min(a.arrivalOrder, b.arrivalOrder);
  }

  private toUtcDate(date: string): Date {
    return new Date(`${date}T00:00:00.000Z`);
  }

  private formatDate(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private toResponse(reservation: SelectedReservation): ReservationResponseDto {
    return {
      id: reservation.id,
      tenantId: reservation.tenantId,
      rideId: reservation.rideId,
      passengerId: reservation.passengerId,
      createdById: reservation.createdById,
      updatedById: reservation.updatedById,
      travelDate: this.formatDate(reservation.travelDate),
      rideDepartureTime: reservation.rideDepartureTime,
      rideArrivalTime: reservation.rideArrivalTime,
      seatNumber: reservation.seatNumber,
      status: reservation.status,
      cancelledAt: reservation.cancelledAt,
      departureStationId: reservation.departureStationId,
      arrivalStationId: reservation.arrivalStationId,
      ride: {
        id: reservation.ride.id,
        name: reservation.ride.name,
        lineId: reservation.ride.lineId
      },
      passenger: {
        id: reservation.passenger.id,
        firstName: reservation.passenger.firstName,
        lastName: reservation.passenger.lastName,
        phone: reservation.passenger.phone
      },
      departureStation: {
        id: reservation.departureStation.id,
        name: reservation.departureStation.name
      },
      arrivalStation: {
        id: reservation.arrivalStation.id,
        name: reservation.arrivalStation.name
      },
      createdAt: reservation.createdAt,
      updatedAt: reservation.updatedAt
    };
  }
}
