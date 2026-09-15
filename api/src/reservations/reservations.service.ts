import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma, ReservationStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AccessTokenPayload } from '../auth/auth.types';
import { withCreateAudit, withUpdateAudit } from '../prisma/audit-write.helper';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, resolvePagination } from '../prisma/repository-helpers';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { CreateReservationsBatchDto } from './dto/create-reservations-batch.dto';
import { ListReservationCountsQueryDto } from './dto/reservation-counts.query.dto';
import { ListReservationsQueryDto } from './dto/list-reservations.query.dto';
import {
  PaginatedReservationsResponseDto,
  ReservationCountsResponseDto,
  ReservationResponseDto
} from './dto/reservation.response.dto';
import {
  BatchReservationsResponseDto,
  ReservationBatchItemResultDto
} from './dto/reservations-batch.response.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import {
  RouteSegment,
  routeBoardingDropoffSets,
  routeStationOrder,
  segmentsOverlap
} from './route-segment';

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
  groupId: true,
  notes: true,
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
  capacity: number;
  stationOrderById: Map<string, number>;
  /** Stations on the route where a passenger may board. */
  boardingStationIds: Set<string>;
  /** Stations on the route where a passenger may get off. */
  dropoffStationIds: Set<string>;
};

type ReservationDbClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class ReservationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    auth: AccessTokenPayload,
    dto: CreateReservationDto
  ): Promise<ReservationResponseDto> {
    const created = await this.prisma.$transaction((tx) =>
      this.createSingleInTransaction(tx, auth, dto)
    );

    return this.toResponse(created);
  }

  async createBatch(
    auth: AccessTokenPayload,
    dto: CreateReservationsBatchDto
  ): Promise<BatchReservationsResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const results: ReservationBatchItemResultDto[] = [];
      const groupId = dto.travelTogether && dto.items.length > 1 ? randomUUID() : null;

      for (let index = 0; index < dto.items.length; index += 1) {
        const item = dto.items[index];
        const created = await this.createSingleInTransaction(tx, auth, item, { groupId });

        results.push({
          index,
          success: true,
          reservation: this.toResponse(created)
        });
      }

      return {
        totalRequested: dto.items.length,
        createdCount: results.length,
        failedCount: 0,
        items: results
      };
    });
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

  /**
   * Passenger counts for every ride instance in a date window.
   *
   * The driver passenger-list page shows a seat count next to each upcoming
   * ride, and fetching the reservations of every instance one by one would be
   * hundreds of requests. A grouped count over the window answers all of them
   * in one, and rides without a single booking simply stay out of the result.
   */
  async countsByRideInstance(
    auth: AccessTokenPayload,
    query: ListReservationCountsQueryDto
  ): Promise<ReservationCountsResponseDto> {
    const from = this.toUtcDate(query.from);
    const to = this.toUtcDate(query.to);

    if (from > to) {
      throw new BadRequestException('from must not be after to');
    }

    const grouped = await this.prisma.reservation.groupBy({
      by: ['rideId', 'travelDate', 'rideDepartureTime'],
      where: {
        tenantId: auth.tenantId,
        status: ReservationStatus.ACTIVE,
        travelDate: { gte: from, lte: to },
        ...(query.rideId ? { rideId: query.rideId } : {})
      },
      _count: { _all: true }
    });

    return {
      items: grouped.map((entry) => ({
        rideId: entry.rideId,
        travelDate: this.formatDate(entry.travelDate),
        rideDepartureTime: entry.rideDepartureTime,
        activeCount: entry._count._all
      }))
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
    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await this.getReservationOrThrow(auth.tenantId, id, tx);

      if (existing.status === ReservationStatus.CANCELLED) {
        throw new BadRequestException('Cancelled reservation cannot be updated');
      }

      const nextPassengerId = dto.passengerId ?? existing.passengerId;
      if (nextPassengerId !== existing.passengerId) {
        await this.ensurePassengerExistsInTenant(auth.tenantId, nextPassengerId, tx);
      }

      const departureStationId = dto.departureStationId ?? existing.departureStationId;
      const arrivalStationId = dto.arrivalStationId ?? existing.arrivalStationId;
      const seatNumber = dto.seatNumber ?? existing.seatNumber;

      // Updating never moves a reservation to a different ride (rideId isn't
      // part of UpdateReservationDto), so this is never the "new reservation
      // on a deactivated line" case the active-line guard exists for.
      const rideContext = await this.getRideRouteContext(auth.tenantId, existing.rideId, tx, {
        requireActiveLine: false
      });
      const segment = this.validateAndResolveSegment(
        rideContext,
        departureStationId,
        arrivalStationId
      );

      await this.acquireRideInstanceLock(tx, {
        tenantId: auth.tenantId,
        rideId: existing.rideId,
        travelDate: existing.travelDate,
        rideDepartureTime: existing.rideDepartureTime
      });

      await this.ensureSeatAndCapacityAreAvailable(tx, {
        tenantId: auth.tenantId,
        rideId: existing.rideId,
        travelDate: existing.travelDate,
        rideDepartureTime: existing.rideDepartureTime,
        seatNumber,
        segment,
        stationOrderById: rideContext.stationOrderById,
        capacity: rideContext.capacity,
        excludeReservationIds: [existing.id]
      });

      return tx.reservation.update({
        where: {
          id
        },
        data: withUpdateAudit(
          {
            ...(dto.passengerId ? { passengerId: dto.passengerId } : {}),
            ...(dto.seatNumber !== undefined ? { seatNumber: dto.seatNumber } : {}),
            ...(dto.departureStationId ? { departureStationId: dto.departureStationId } : {}),
            ...(dto.arrivalStationId ? { arrivalStationId: dto.arrivalStationId } : {}),
            ...(dto.notes !== undefined
              ? { notes: dto.notes && dto.notes.trim() ? dto.notes.trim() : null }
              : {})
          },
          auth.sub
        ),
        select: SAFE_RESERVATION_SELECT
      });
    });

    return this.toResponse(updated);
  }

  /**
   * Moves a reservation without briefly freeing either seat.  A destination
   * occupied on the same route segment is swapped in the same transaction,
   * so drag-and-drop can never leave two passengers assigned to one seat.
   */
  async moveSeat(
    auth: AccessTokenPayload,
    id: string,
    targetSeatNumber: number
  ): Promise<ReservationResponseDto[]> {
    const moved = await this.prisma.$transaction(async (tx) => {
      // This first read only identifies the advisory-lock scope. Read the
      // source again after the lock, since another move may have completed
      // while this transaction was waiting for it.
      const sourceBeforeLock = await this.getReservationOrThrow(auth.tenantId, id, tx);

      await this.acquireRideInstanceLock(tx, {
        tenantId: auth.tenantId,
        rideId: sourceBeforeLock.rideId,
        travelDate: sourceBeforeLock.travelDate,
        rideDepartureTime: sourceBeforeLock.rideDepartureTime
      });

      const source = await this.getReservationOrThrow(auth.tenantId, id, tx);

      if (source.status === ReservationStatus.CANCELLED) {
        throw new BadRequestException('Cancelled reservation cannot be moved');
      }

      if (source.seatNumber === targetSeatNumber) {
        return [source];
      }

      // Moving a seat keeps this reservation on the same ride, so a
      // deactivated line must not prevent the change.
      const rideContext = await this.getRideRouteContext(auth.tenantId, source.rideId, tx, {
        requireActiveLine: false
      });
      const sourceSegment = this.validateAndResolveSegment(
        rideContext,
        source.departureStationId,
        source.arrivalStationId
      );

      const activeReservations = await tx.reservation.findMany({
        where: {
          tenantId: auth.tenantId,
          rideId: source.rideId,
          travelDate: source.travelDate,
          rideDepartureTime: source.rideDepartureTime,
          status: ReservationStatus.ACTIVE
        },
        select: SAFE_RESERVATION_SELECT
      });

      const destination = activeReservations.find((reservation) => {
        if (reservation.id === source.id || reservation.seatNumber !== targetSeatNumber) {
          return false;
        }

        const destinationSegment = this.validateAndResolveSegment(
          rideContext,
          reservation.departureStationId,
          reservation.arrivalStationId
        );
        return segmentsOverlap(sourceSegment, destinationSegment);
      });

      const excludedReservationIds = destination ? [source.id, destination.id] : [source.id];
      await this.ensureSeatAndCapacityAreAvailable(tx, {
        tenantId: auth.tenantId,
        rideId: source.rideId,
        travelDate: source.travelDate,
        rideDepartureTime: source.rideDepartureTime,
        seatNumber: targetSeatNumber,
        segment: sourceSegment,
        stationOrderById: rideContext.stationOrderById,
        capacity: rideContext.capacity,
        excludeReservationIds: excludedReservationIds
      });

      if (destination) {
        const destinationSegment = this.validateAndResolveSegment(
          rideContext,
          destination.departureStationId,
          destination.arrivalStationId
        );
        await this.ensureSeatAndCapacityAreAvailable(tx, {
          tenantId: auth.tenantId,
          rideId: source.rideId,
          travelDate: source.travelDate,
          rideDepartureTime: source.rideDepartureTime,
          seatNumber: source.seatNumber,
          segment: destinationSegment,
          stationOrderById: rideContext.stationOrderById,
          capacity: rideContext.capacity,
          excludeReservationIds: excludedReservationIds
        });
      }

      const updateSeat = (reservationId: string, seatNumber: number) =>
        tx.reservation.update({
          where: { id: reservationId },
          data: withUpdateAudit({ seatNumber }, auth.sub),
          select: SAFE_RESERVATION_SELECT
        });

      const updatedSource = await updateSeat(source.id, targetSeatNumber);
      if (!destination) {
        return [updatedSource];
      }

      const updatedDestination = await updateSeat(destination.id, source.seatNumber);
      return [updatedSource, updatedDestination];
    });

    return moved.map((reservation) => this.toResponse(reservation));
  }

  async cancel(auth: AccessTokenPayload, id: string): Promise<ReservationResponseDto> {
    return this.softDelete(auth, id, false);
  }

  async softDelete(
    auth: AccessTokenPayload,
    id: string,
    strict: boolean = false
  ): Promise<ReservationResponseDto> {
    const cancelled = await this.prisma.$transaction(async (tx) => {
      const reservationBeforeLock = await this.getReservationOrThrow(auth.tenantId, id, tx);

      await this.acquireRideInstanceLock(tx, {
        tenantId: auth.tenantId,
        rideId: reservationBeforeLock.rideId,
        travelDate: reservationBeforeLock.travelDate,
        rideDepartureTime: reservationBeforeLock.rideDepartureTime
      });

      const existing = await this.getReservationOrThrow(auth.tenantId, id, tx);
      if (existing.status === ReservationStatus.CANCELLED) {
        if (strict) {
          throw new BadRequestException('Reservation is already cancelled');
        }

        return existing;
      }

      return tx.reservation.update({
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
    });

    return this.toResponse(cancelled);
  }

  private async getReservationOrThrow(
    tenantId: string,
    id: string,
    db: ReservationDbClient = this.prisma
  ): Promise<SelectedReservation> {
    const reservation = await db.reservation.findFirst({
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

  private async getRideRouteContext(
    tenantId: string,
    rideId: string,
    db: ReservationDbClient = this.prisma,
    options: { requireActiveLine?: boolean } = {}
  ): Promise<RideRouteContext> {
    const { requireActiveLine = true } = options;
    const ride = await db.ride.findFirst({
      where: {
        id: rideId,
        tenantId
      },
      select: {
        id: true,
        capacity: true,
        line: {
          select: {
            isActive: true,
            departureStationId: true,
            arrivalStationId: true,
            intermediateStops: {
              select: {
                stationId: true,
                orderIndex: true,
                isBoarding: true,
                isDropoff: true
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

    if (requireActiveLine && !ride.line.isActive) {
      throw new BadRequestException('Ride line is deactivated and cannot take new reservations');
    }

    const stationOrderById = routeStationOrder(ride.line);
    const { boardingStationIds, dropoffStationIds } = routeBoardingDropoffSets(ride.line);

    return {
      rideId: ride.id,
      capacity: ride.capacity,
      stationOrderById,
      boardingStationIds,
      dropoffStationIds
    };
  }

  private validateAndResolveSegment(
    route: RideRouteContext,
    departureStationId: string,
    arrivalStationId: string
  ): RouteSegment {
    const { stationOrderById } = route;

    if (departureStationId === arrivalStationId) {
      throw new BadRequestException('Departure and arrival stations must be different');
    }

    const departureOrder = stationOrderById.get(departureStationId);
    const arrivalOrder = stationOrderById.get(arrivalStationId);

    if (departureOrder === undefined || arrivalOrder === undefined) {
      throw new BadRequestException(
        'Departure and arrival stations must exist on the ride line path'
      );
    }

    if (departureOrder >= arrivalOrder) {
      throw new BadRequestException(
        'Departure station must come before arrival station on line path'
      );
    }

    if (!route.boardingStationIds.has(departureStationId)) {
      throw new BadRequestException('Departure station is not a boarding stop on this line');
    }

    if (!route.dropoffStationIds.has(arrivalStationId)) {
      throw new BadRequestException('Arrival station is not a drop-off stop on this line');
    }

    return {
      departureOrder,
      arrivalOrder
    };
  }

  private async ensurePassengerExistsInTenant(
    tenantId: string,
    passengerId: string,
    db: ReservationDbClient = this.prisma
  ): Promise<void> {
    const passenger = await db.passenger.findFirst({
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

  private async ensureSeatAndCapacityAreAvailable(
    db: ReservationDbClient,
    input: {
      tenantId: string;
      rideId: string;
      travelDate: Date;
      rideDepartureTime: string;
      seatNumber: number;
      segment: RouteSegment;
      stationOrderById: Map<string, number>;
      capacity: number;
      excludeReservationIds?: string[];
    }
  ): Promise<void> {
    if (input.seatNumber > input.capacity) {
      throw new ConflictException('Seat number exceeds ride capacity');
    }

    const existing = await db.reservation.findMany({
      where: {
        tenantId: input.tenantId,
        rideId: input.rideId,
        travelDate: input.travelDate,
        rideDepartureTime: input.rideDepartureTime,
        status: ReservationStatus.ACTIVE,
        ...(input.excludeReservationIds?.length
          ? {
              id: {
                notIn: input.excludeReservationIds
              }
            }
          : {})
      },
      select: {
        id: true,
        seatNumber: true,
        departureStationId: true,
        arrivalStationId: true
      }
    });

    let overlappingReservationsCount = 0;
    let offRouteConflict = false;
    const hasOverlapSeatConflict = existing.some((item) => {
      const departureOrder = input.stationOrderById.get(item.departureStationId);
      const arrivalOrder = input.stationOrderById.get(item.arrivalStationId);

      // Another active reservation on this departure names a station that is
      // not on the current route, so its segment cannot be placed and cannot be
      // ruled out as a collision either. Treating it as one is the safe
      // direction to be wrong in, but the real problem is the route, not the
      // seat this booking is asking for.
      if (departureOrder === undefined || arrivalOrder === undefined) {
        offRouteConflict = true;
        return true;
      }

      const overlaps = segmentsOverlap(
        {
          departureOrder,
          arrivalOrder
        },
        input.segment
      );

      if (!overlaps) {
        return false;
      }

      overlappingReservationsCount += 1;
      return item.seatNumber === input.seatNumber;
    });

    if (hasOverlapSeatConflict) {
      if (offRouteConflict) {
        throw new ConflictException(
          'Cannot confirm seat availability: another reservation on this departure has a station that is no longer on the route. Run the reservation.stationsOnRoute integrity check to find and resolve it.'
        );
      }

      throw new ConflictException('Seat is already booked for this route segment');
    }

    if (overlappingReservationsCount >= input.capacity) {
      throw new ConflictException('Ride capacity is exhausted for this route segment');
    }
  }

  private async createSingleInTransaction(
    tx: Prisma.TransactionClient,
    auth: AccessTokenPayload,
    dto: CreateReservationDto,
    options: { groupId?: string | null } = {}
  ): Promise<SelectedReservation> {
    const rideContext = await this.getRideRouteContext(auth.tenantId, dto.rideId, tx);
    await this.ensurePassengerExistsInTenant(auth.tenantId, dto.passengerId, tx);

    const segment = this.validateAndResolveSegment(
      rideContext,
      dto.departureStationId,
      dto.arrivalStationId
    );

    const travelDate = this.toUtcDate(dto.travelDate);
    await this.acquireRideInstanceLock(tx, {
      tenantId: auth.tenantId,
      rideId: dto.rideId,
      travelDate,
      rideDepartureTime: dto.rideDepartureTime
    });

    await this.ensureSeatAndCapacityAreAvailable(tx, {
      tenantId: auth.tenantId,
      rideId: dto.rideId,
      travelDate,
      rideDepartureTime: dto.rideDepartureTime,
      seatNumber: dto.seatNumber,
      segment,
      stationOrderById: rideContext.stationOrderById,
      capacity: rideContext.capacity
    });

    return tx.reservation.create({
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
          cancelledAt: null,
          groupId: options.groupId ?? null,
          notes: dto.notes?.trim() ? dto.notes.trim() : null
        },
        auth.sub
      ),
      select: SAFE_RESERVATION_SELECT
    });
  }

  private async acquireRideInstanceLock(
    tx: Prisma.TransactionClient,
    input: {
      tenantId: string;
      rideId: string;
      travelDate: Date;
      rideDepartureTime: string;
    }
  ): Promise<void> {
    const lockKey = [
      input.tenantId,
      input.rideId,
      this.formatDate(input.travelDate),
      input.rideDepartureTime
    ].join(':');

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
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
      groupId: reservation.groupId,
      notes: reservation.notes,
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
