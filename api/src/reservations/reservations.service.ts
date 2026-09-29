import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma, ReservationStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AccessTokenPayload } from '../auth/auth.types';
import {
  BookingDeparture,
  BookingDepartureRequest,
  assertBookable,
  departureRoute,
  loadBookingDeparture,
  resolveBookingDepartureId
} from '../departures/booking-departure';
import { lockDepartures } from '../departures/departure-lock';
import { withCreateAudit, withUpdateAudit } from '../prisma/audit-write.helper';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, resolvePagination } from '../prisma/repository-helpers';
import { PrismaService } from '../prisma/prisma.service';
import { reservationWriteTransaction } from '../prisma/schedule-lock';
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
import { CancellationPreviewDto, CancellationPreviewResponseDto } from './dto/cancellation-preview.dto';
import { AssignReservationGroupDto } from './dto/assign-reservation-group.dto';
import { asReturnLegConflict, linkReturnLeg } from './return-leg-link';
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
  departureId: true,
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
  roundTripId: true,
  returnOfReservationId: true,
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

type DepartureRouteContext = {
  departureId: string;
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
    const created = await reservationWriteTransaction(this.prisma, auth.tenantId, (tx) =>
      this.createSingleInTransaction(tx, auth, dto, randomUUID())
    );

    return this.toResponse(created);
  }

  async createBatch(
    auth: AccessTokenPayload,
    dto: CreateReservationsBatchDto
  ): Promise<BatchReservationsResponseDto> {
    dto.items.forEach((item, index) => {
      if (item.returnOfIndex !== undefined) {
        if (!Number.isInteger(item.returnOfIndex) || item.returnOfIndex < 0 || item.returnOfIndex >= index) {
          throw new BadRequestException('returnOfIndex must refer to an earlier item in the batch');
        }
        if (item.returnOfReservationId !== undefined) {
          throw new BadRequestException('Specify either returnOfIndex or returnOfReservationId');
        }
      }
    });

    return reservationWriteTransaction(this.prisma, auth.tenantId, async (tx) => {
      const results: ReservationBatchItemResultDto[] = [];
      const groupIds = new Map<string, string>();
      const createdIds: string[] = [];
      const batchRoundTripId = randomUUID();

      // Every departure of the batch is named first and locked in one go, in
      // ID order, so two batches sharing buses cannot each hold one the other
      // waits for.
      const departureIds: string[] = [];
      for (const item of dto.items) {
        departureIds.push(await resolveBookingDepartureId(tx, this.bookingRequest(auth, item)));
      }
      await lockDepartures(tx, departureIds);

      const groupIdFor = (item: CreateReservationDto, departureId: string): string => {
        const key = dto.travelTogether ? departureId : `${departureId}:${item.passengerId}`;
        const existing = groupIds.get(key);
        if (existing) {
          return existing;
        }

        const created = randomUUID();
        groupIds.set(key, created);
        return created;
      };

      for (let index = 0; index < dto.items.length; index += 1) {
        const item = dto.items[index];
        const outboundId = item.returnOfIndex === undefined ? item.returnOfReservationId : createdIds[item.returnOfIndex];
        const created = await this.createSingleInTransaction(
          tx,
          auth,
          { ...item, returnOfReservationId: outboundId },
          groupIdFor(item, departureIds[index]),
          { lockedDepartureId: departureIds[index], roundTripId: batchRoundTripId }
        );
        createdIds.push(created.id);

        if (item.returnOfIndex !== undefined) {
          const outbound = results[item.returnOfIndex].reservation;
          if (outbound) outbound.roundTripId = created.roundTripId;
        }

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

  async cancellationPreview(
    auth: AccessTokenPayload,
    dto: CancellationPreviewDto
  ): Promise<CancellationPreviewResponseDto> {
    const selected = await this.prisma.reservation.findMany({
      where: { tenantId: auth.tenantId, id: { in: dto.reservationIds }, status: ReservationStatus.ACTIVE },
      select: SAFE_RESERVATION_SELECT
    });
    if (selected.length !== new Set(dto.reservationIds).size) {
      throw new NotFoundException('One or more active reservations were not found');
    }

    const groupIds = selected.map((item) => item.groupId).filter((id): id is string => Boolean(id));
    const primary = dto.scope === 'groups' && groupIds.length > 0
      ? await this.prisma.reservation.findMany({
          where: {
            tenantId: auth.tenantId,
            status: ReservationStatus.ACTIVE,
            OR: [{ groupId: { in: groupIds } }, { id: { in: dto.reservationIds } }]
          },
          select: SAFE_RESERVATION_SELECT
        })
      : selected;

    const primaryIds = primary.map((item) => item.id);
    const returns = await this.prisma.reservation.findMany({
      where: {
        tenantId: auth.tenantId,
        status: ReservationStatus.ACTIVE,
        id: { notIn: primaryIds },
        OR: [
          { returnOf: { id: { in: primaryIds } } },
          { returnLegs: { some: { id: { in: primaryIds } } } }
        ]
      },
      select: SAFE_RESERVATION_SELECT
    });
    return {
      outboundReservations: primary.map((item) => this.toResponse(item)),
      returnReservations: returns.map((item) => this.toResponse(item))
    };
  }

  async assignGroup(
    auth: AccessTokenPayload,
    dto: AssignReservationGroupDto
  ): Promise<ReservationResponseDto[]> {
    const ids = [...new Set(dto.reservationIds)];
    return reservationWriteTransaction(this.prisma, auth.tenantId, async (tx) => {
      const reservations = await tx.reservation.findMany({
        where: { tenantId: auth.tenantId, id: { in: ids }, status: ReservationStatus.ACTIVE },
        select: SAFE_RESERVATION_SELECT
      });
      if (reservations.length !== ids.length) {
        throw new NotFoundException('One or more active reservations were not found');
      }
      const departures = new Set(reservations.map((item) => item.departureId));
      if (departures.size !== 1 || departures.has(null)) {
        throw new BadRequestException('Reservations must belong to the same departure');
      }
      await lockDepartures(tx, departures);
      await tx.reservation.updateMany({
        where: { tenantId: auth.tenantId, id: { in: ids }, status: ReservationStatus.ACTIVE },
        data: withUpdateAudit({ groupId: dto.groupId }, auth.sub)
      });
      const updated = await tx.reservation.findMany({
        where: { tenantId: auth.tenantId, id: { in: ids } },
        select: SAFE_RESERVATION_SELECT
      });
      return updated.map((item) => this.toResponse(item));
    });
  }

  async update(
    auth: AccessTokenPayload,
    id: string,
    dto: UpdateReservationDto
  ): Promise<ReservationResponseDto> {
    const updated = await reservationWriteTransaction(this.prisma, auth.tenantId, async (tx) => {
      // Read once to find the bus, and again under its lock, since another
      // write on the same bus may have landed while this one waited.
      const beforeLock = await this.getReservationOrThrow(auth.tenantId, id, tx);
      const departureId = this.linkedDepartureOrThrow(beforeLock);
      await lockDepartures(tx, [departureId]);
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

      // Updating never moves a reservation to another departure, and a
      // passenger on a bus that no longer runs can still be edited: the
      // departure is read for its seats and route, not asked whether it runs.
      const route = this.routeContextOf(
        await loadBookingDeparture(tx, auth.tenantId, departureId)
      );
      const segment = this.validateAndResolveSegment(route, departureStationId, arrivalStationId);

      await this.ensureSeatAndCapacityAreAvailable(tx, {
        tenantId: auth.tenantId,
        route,
        seatNumber,
        segment,
        excludeReservationIds: [existing.id]
      });

      // Linking is repairable after the fact: a backfill that refuses to guess
      // between two candidate outbound legs leaves the row unlinked, and this
      // is how somebody who knows what the passenger asked for fixes it.
      //
      // A retained link is revalidated rather than trusted. The link asserts
      // one passenger and a reversed station pair, and all three of those
      // fields can change in this request — leaving the assertion standing
      // while the row moves out from under it is the silent drift the
      // round-trip check exists to catch, manufactured by the repair path.
      const linkedFieldsChanged =
        nextPassengerId !== existing.passengerId ||
        departureStationId !== existing.departureStationId ||
        arrivalStationId !== existing.arrivalStationId;

      const outboundToValidate =
        dto.returnOfReservationId !== undefined
          ? dto.returnOfReservationId
          : linkedFieldsChanged
            ? existing.returnOfReservationId
            : null;

      const returnLeg = outboundToValidate
        ? await linkReturnLeg(tx, {
            tenantId: auth.tenantId,
            actorId: auth.sub,
            outboundReservationId: outboundToValidate,
            leg: {
              passengerId: nextPassengerId,
              departureStationId,
              arrivalStationId,
              travelDate: existing.travelDate,
              rideDepartureTime: existing.rideDepartureTime
            },
            excludeReservationId: existing.id
          })
        : null;

      try {
        return await tx.reservation.update({
          where: {
            id
          },
          data: withUpdateAudit(
            {
              ...(dto.groupId !== undefined ? { groupId: dto.groupId } : {}),
              ...(dto.passengerId ? { passengerId: dto.passengerId } : {}),
              ...(dto.seatNumber !== undefined ? { seatNumber: dto.seatNumber } : {}),
              ...(dto.departureStationId ? { departureStationId: dto.departureStationId } : {}),
              ...(dto.arrivalStationId ? { arrivalStationId: dto.arrivalStationId } : {}),
              ...(dto.notes !== undefined
                ? { notes: dto.notes && dto.notes.trim() ? dto.notes.trim() : null }
                : {}),
              ...(returnLeg
                ? {
                    returnOfReservationId: returnLeg.returnOfReservationId,
                    roundTripId: returnLeg.roundTripId
                  }
                : {}),
              // Unlinking also clears the marker assigned when this pair was linked.
              ...(dto.returnOfReservationId === null
                ? { returnOfReservationId: null, roundTripId: null }
                : {})
            },
            auth.sub
          ),
          select: SAFE_RESERVATION_SELECT
        });
      } catch (error) {
        throw asReturnLegConflict(error);
      }
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
    const moved = await reservationWriteTransaction(this.prisma, auth.tenantId, async (tx) => {
      // This first read only identifies the departure to lock. Read the
      // source again after the lock, since another move may have completed
      // while this transaction was waiting for it.
      const sourceBeforeLock = await this.getReservationOrThrow(auth.tenantId, id, tx);
      const departureId = this.linkedDepartureOrThrow(sourceBeforeLock);
      await lockDepartures(tx, [departureId]);

      const source = await this.getReservationOrThrow(auth.tenantId, id, tx);

      if (source.status === ReservationStatus.CANCELLED) {
        throw new BadRequestException('Cancelled reservation cannot be moved');
      }

      if (source.seatNumber === targetSeatNumber) {
        return [source];
      }

      // Moving a seat keeps this reservation on the same departure, so one
      // that no longer runs must not prevent the change.
      const route = this.routeContextOf(
        await loadBookingDeparture(tx, auth.tenantId, departureId)
      );
      const sourceSegment = this.validateAndResolveSegment(
        route,
        source.departureStationId,
        source.arrivalStationId
      );

      const activeReservations = await tx.reservation.findMany({
        where: {
          tenantId: auth.tenantId,
          departureId,
          status: ReservationStatus.ACTIVE
        },
        select: SAFE_RESERVATION_SELECT
      });

      const destination = activeReservations.find((reservation) => {
        if (reservation.id === source.id || reservation.seatNumber !== targetSeatNumber) {
          return false;
        }

        const destinationSegment = this.validateAndResolveSegment(
          route,
          reservation.departureStationId,
          reservation.arrivalStationId
        );
        return segmentsOverlap(sourceSegment, destinationSegment);
      });

      const excludedReservationIds = destination ? [source.id, destination.id] : [source.id];
      await this.ensureSeatAndCapacityAreAvailable(tx, {
        tenantId: auth.tenantId,
        route,
        seatNumber: targetSeatNumber,
        segment: sourceSegment,
        excludeReservationIds: excludedReservationIds
      });

      if (destination) {
        const destinationSegment = this.validateAndResolveSegment(
          route,
          destination.departureStationId,
          destination.arrivalStationId
        );
        await this.ensureSeatAndCapacityAreAvailable(tx, {
          tenantId: auth.tenantId,
          route,
          seatNumber: source.seatNumber,
          segment: destinationSegment,
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
    const cancelled = await reservationWriteTransaction(this.prisma, auth.tenantId, async (tx) => {
      const reservationBeforeLock = await this.getReservationOrThrow(auth.tenantId, id, tx);

      // Cancelling is never refused for want of a departure: an unlinked row
      // frees no seat anyone else can count, so it has nothing to lock.
      await lockDepartures(tx, [reservationBeforeLock.departureId]);

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

  /**
   * Seats and route of the departure a reservation is on (#27, PR 3b): its
   * capacity, and its stored stops, which keep the route a past departure ran
   * with and carry every station of an extra bus.
   */
  private routeContextOf(departure: BookingDeparture): DepartureRouteContext {
    const route = departureRoute(departure.stops);

    return {
      departureId: departure.id,
      capacity: departure.capacity,
      stationOrderById: routeStationOrder(route),
      ...routeBoardingDropoffSets(route)
    };
  }

  /**
   * Every reservation is linked since PR 2's backfill, and every booking links
   * itself, so an unlinked row is drift `reservation.departureLinked` reports.
   * Its seats cannot be counted on any bus, so it is not edited until linked.
   */
  private linkedDepartureOrThrow(reservation: SelectedReservation): string {
    if (!reservation.departureId) {
      throw new ConflictException({
        code: 'RESERVATION_NOT_LINKED',
        message:
          'Rezervacija nije vezana za polazak, pa ne moze da se menja. Pokrenite proveru "Rezervacija je vezana za svoj polazak" ili javite podrsci.'
      });
    }

    return reservation.departureId;
  }

  private bookingRequest(auth: AccessTokenPayload, dto: CreateReservationDto): BookingDepartureRequest {
    return {
      tenantId: auth.tenantId,
      departureId: dto.departureId,
      rideId: dto.rideId,
      travelDate: this.toUtcDate(dto.travelDate),
      departureTime: dto.rideDepartureTime,
      arrivalTime: dto.rideArrivalTime
    };
  }

  private validateAndResolveSegment(
    route: DepartureRouteContext,
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
      route: DepartureRouteContext;
      seatNumber: number;
      segment: RouteSegment;
      excludeReservationIds?: string[];
    }
  ): Promise<void> {
    const { capacity, stationOrderById } = input.route;

    if (input.seatNumber > capacity) {
      throw new ConflictException('Seat number exceeds ride capacity');
    }

    const existing = await db.reservation.findMany({
      where: {
        tenantId: input.tenantId,
        // Counted by the bus, never by the time copies: a reservation whose
        // copy a route edit left behind still holds its seat (#14).
        departureId: input.route.departureId,
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
      const departureOrder = stationOrderById.get(item.departureStationId);
      const arrivalOrder = stationOrderById.get(item.arrivalStationId);

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

    if (overlappingReservationsCount >= capacity) {
      throw new ConflictException('Ride capacity is exhausted for this route segment');
    }
  }

  private async createSingleInTransaction(
    tx: Prisma.TransactionClient,
    auth: AccessTokenPayload,
    dto: CreateReservationDto,
    groupId: string,
    options: { lockedDepartureId?: string; roundTripId?: string } = {}
  ): Promise<SelectedReservation> {
    const request = this.bookingRequest(auth, dto);
    let departureId = options.lockedDepartureId;

    if (!departureId) {
      departureId = await resolveBookingDepartureId(tx, request);
      await lockDepartures(tx, [departureId]);
    }

    // Read under the row lock, like every read that decides this booking: a
    // cancellation or another booking on this bus has landed by now.
    const departure = await loadBookingDeparture(tx, auth.tenantId, departureId);
    assertBookable(departure, request);

    if (!departure.line.isActive) {
      throw new BadRequestException('Ride line is deactivated and cannot take new reservations');
    }

    const route = this.routeContextOf(departure);
    await this.ensurePassengerExistsInTenant(auth.tenantId, dto.passengerId, tx);

    const segment = this.validateAndResolveSegment(
      route,
      dto.departureStationId,
      dto.arrivalStationId
    );

    const travelDate = departure.serviceDate;

    // After the departure lock, never before: linking row-locks the outbound
    // reservation to stamp its booking marker, and update takes these two
    // locks in this order. Taking them the other way round here lets a create
    // and an update on the same pair each hold what the other waits for, and
    // Postgres resolves that by aborting one operator's booking.
    const returnLeg = dto.returnOfReservationId
      ? await linkReturnLeg(tx, {
          tenantId: auth.tenantId,
          actorId: auth.sub,
          outboundReservationId: dto.returnOfReservationId,
          bookingMarker: options.roundTripId,
          leg: {
            passengerId: dto.passengerId,
            departureStationId: dto.departureStationId,
            arrivalStationId: dto.arrivalStationId,
            travelDate,
            rideDepartureTime: departure.departureTime
          }
        })
      : null;

    await this.ensureSeatAndCapacityAreAvailable(tx, {
      tenantId: auth.tenantId,
      route,
      seatNumber: dto.seatNumber,
      segment
    });

    try {
      return await tx.reservation.create({
        data: withCreateAudit(
          {
            tenantId: auth.tenantId,
            // From the departure, not the request: the copies are the bus's.
            rideId: departure.rideId,
            departureId: departure.id,
            passengerId: dto.passengerId,
            travelDate,
            rideDepartureTime: departure.departureTime,
            rideArrivalTime: departure.arrivalTime,
            seatNumber: dto.seatNumber,
            departureStationId: dto.departureStationId,
            arrivalStationId: dto.arrivalStationId,
            status: ReservationStatus.ACTIVE,
            cancelledAt: null,
            groupId,
            notes: dto.notes?.trim() ? dto.notes.trim() : null,
            returnOfReservationId: returnLeg?.returnOfReservationId ?? null,
            // The booking marker is the server's to mint: a return leg takes it
            // from its outbound leg, so the two sides of a booking can never
            // disagree about which booking they belong to. A one-way leg carries
            // none until a return leg turns it into a round trip.
            roundTripId: returnLeg?.roundTripId ?? null
          },
          auth.sub
        ),
        select: SAFE_RESERVATION_SELECT
      });
    } catch (error) {
      throw asReturnLegConflict(error);
    }
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
      departureId: reservation.departureId,
      roundTripId: reservation.roundTripId,
      returnOfReservationId: reservation.returnOfReservationId,
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
