import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma, ReservationStatus, RideExceptionType, RideStatus, RideType } from '@prisma/client';
import { AccessTokenPayload } from '../auth/auth.types';
import { withCreateAudit, withUpdateAudit } from '../prisma/audit-write.helper';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, resolvePagination } from '../prisma/repository-helpers';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRideDto } from './dto/create-ride.dto';
import { ListRideInstancesQueryDto } from './dto/ride-instances.query.dto';
import { ListRidesQueryDto } from './dto/list-rides.query.dto';
import { RideDayScheduleInputDto } from './dto/ride-day-time.dto';
import { CreateRideExceptionDto } from './dto/ride-exception.dto';
import {
  PaginatedRidesResponseDto,
  RideInstanceResponseDto,
  RideInstancesByDateResponseDto,
  RideExceptionResponseDto,
  RideResponseDto
} from './dto/ride.response.dto';
import { UpdateRideDto } from './dto/update-ride.dto';

const SAFE_RIDE_SELECT = Prisma.validator<Prisma.RideSelect>()({
  id: true,
  tenantId: true,
  lineId: true,
  createdById: true,
  updatedById: true,
  name: true,
  capacity: true,
  type: true,
  status: true,
  recurringStartDate: true,
  recurringEndDate: true,
  oneTimeDate: true,
  oneTimeDepartureTime: true,
  oneTimeArrivalTime: true,
  createdAt: true,
  updatedAt: true,
  line: {
    select: {
      id: true,
      name: true,
      departureStationId: true,
      arrivalStationId: true,
      intermediateStops: {
        select: {
          stationId: true,
          orderIndex: true
        },
        orderBy: {
          orderIndex: 'asc' as const
        }
      }
    }
  },
  daySchedules: {
    select: {
      dayOfWeek: true,
      stationTimes: {
        select: {
          stationId: true,
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
  },
  exceptions: {
    select: {
      id: true,
      exceptionDate: true,
      type: true,
      departureTime: true,
      arrivalTime: true,
      createdById: true,
      updatedById: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: [
      {
        exceptionDate: 'asc'
      },
      {
        createdAt: 'asc'
      }
    ]
  }
});

type SelectedRide = Prisma.RideGetPayload<{ select: typeof SAFE_RIDE_SELECT }>;
type RideExceptionRecord = Prisma.RideExceptionGetPayload<{
  select: {
    id: true;
    exceptionDate: true;
    type: true;
    departureTime: true;
    arrivalTime: true;
    createdById: true;
    updatedById: true;
    createdAt: true;
    updatedAt: true;
  };
}>;

type RideWithInstanceMaterialization = Prisma.RideGetPayload<{
  select: {
    id: true;
    tenantId: true;
    lineId: true;
    name: true;
    capacity: true;
    type: true;
    status: true;
    recurringStartDate: true;
    recurringEndDate: true;
    oneTimeDate: true;
    oneTimeDepartureTime: true;
    oneTimeArrivalTime: true;
    line: {
      select: {
        id: true;
        name: true;
        departureStationId: true;
        arrivalStationId: true;
        intermediateStops: {
          select: {
            stationId: true;
            orderIndex: true;
          };
          orderBy: {
            orderIndex: 'asc';
          };
        };
      };
    };
    daySchedules: {
      select: {
        dayOfWeek: true;
        stationTimes: {
          select: {
            stationId: true;
            orderIndex: true;
            time: true;
          };
          orderBy: {
            orderIndex: 'asc';
          };
        };
      };
      orderBy: {
        dayOfWeek: 'asc';
      };
    };
    exceptions: {
      select: {
        exceptionDate: true;
        type: true;
        departureTime: true;
        arrivalTime: true;
      };
      where: {
        exceptionDate: Date;
      };
      orderBy: {
        createdAt: 'asc';
      };
    };
  };
}>;

type MaterializedRideInstance = {
  rideId: string;
  date: string;
  departureTime: string;
  arrivalTime: string;
  source: 'BASE' | 'ADDITIONAL';
  rideType: RideType;
  status: RideStatus;
  capacity: number;
  line: {
    id: string;
    name: string;
    departureStationId: string;
    arrivalStationId: string;
  };
};

type RideScheduleInput = {
  type: RideType;
  routeStationIds: string[];
  recurringStartDate: string | undefined;
  recurringEndDate: string | undefined;
  oneTimeDate: string | undefined;
  oneTimeDepartureTime: string | undefined;
  oneTimeArrivalTime: string | undefined;
  daySchedules: RideDayScheduleInputDto[] | undefined;
};

type RideScheduleNormalized = {
  type: RideType;
  recurringStartDate: Date | null;
  recurringEndDate: Date | null;
  oneTimeDate: Date | null;
  oneTimeDepartureTime: string | null;
  oneTimeArrivalTime: string | null;
  daySchedules: RideDayScheduleInputDto[];
};

@Injectable()
export class RidesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(auth: AccessTokenPayload, dto: CreateRideDto): Promise<RideResponseDto> {
    const line = await this.ensureLineInTenant(auth.tenantId, dto.lineId);

    const normalizedSchedule = this.normalizeAndValidateSchedule({
      type: dto.type,
      routeStationIds: line.routeStationIds,
      recurringStartDate: dto.recurringStartDate,
      recurringEndDate: dto.recurringEndDate,
      oneTimeDate: dto.oneTimeDate,
      oneTimeDepartureTime: dto.oneTimeDepartureTime,
      oneTimeArrivalTime: dto.oneTimeArrivalTime,
      daySchedules: dto.daySchedules
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const createdRide = await tx.ride.create({
        data: withCreateAudit(
          {
            tenantId: auth.tenantId,
            lineId: dto.lineId,
            name: dto.name?.trim() || line.name,
            capacity: dto.capacity,
            type: normalizedSchedule.type,
            status: dto.status ?? RideStatus.DRAFT,
            recurringStartDate: normalizedSchedule.recurringStartDate,
            recurringEndDate: normalizedSchedule.recurringEndDate,
            oneTimeDate: normalizedSchedule.oneTimeDate,
            oneTimeDepartureTime: normalizedSchedule.oneTimeDepartureTime,
            oneTimeArrivalTime: normalizedSchedule.oneTimeArrivalTime
          },
          auth.sub
        ),
        select: {
          id: true
        }
      });

      if (normalizedSchedule.daySchedules.length > 0) {
        await this.replaceRideDaySchedulesTx(
          tx,
          auth.tenantId,
          createdRide.id,
          auth.sub,
          normalizedSchedule.daySchedules,
          false
        );
      }

      return tx.ride.findFirst({
        where: {
          id: createdRide.id,
          tenantId: auth.tenantId
        },
        select: SAFE_RIDE_SELECT
      });
    });

    if (!created) {
      throw new NotFoundException('Ride not found');
    }

    return this.toRideResponse(created);
  }

  async list(auth: AccessTokenPayload, query: ListRidesQueryDto): Promise<PaginatedRidesResponseDto> {
    const pagination = resolvePagination(query.page, query.pageSize);
    const term = query.search?.trim();

    const where = {
      tenantId: auth.tenantId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(term
        ? {
            OR: [
              { name: { contains: term, mode: 'insensitive' as const } },
              { line: { name: { contains: term, mode: 'insensitive' as const } } }
            ]
          }
        : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.ride.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ createdAt: 'desc' }],
        select: SAFE_RIDE_SELECT
      }),
      this.prisma.ride.count({ where })
    ]);

    return {
      items: items.map((item) => this.toRideResponse(item)),
      total,
      page: pagination.page ?? DEFAULT_PAGE,
      pageSize: pagination.pageSize ?? DEFAULT_PAGE_SIZE
    };
  }

  async listInstancesByDate(
    auth: AccessTokenPayload,
    query: ListRideInstancesQueryDto
  ): Promise<RideInstancesByDateResponseDto> {
    const timezoneOffsetMinutes = query.timezoneOffsetMinutes ?? 0;
    const utcDate = this.resolveUtcDateFromLocalDate(query.date);
    const targetDate = this.formatDate(utcDate)!;
    const targetDayOfWeek = this.getDayOfWeekFromDateString(query.date);

    const rides = await this.prisma.ride.findMany({
      where: {
        tenantId: auth.tenantId,
        status: RideStatus.ACTIVE
      },
      select: {
        id: true,
        tenantId: true,
        lineId: true,
        name: true,
        capacity: true,
        type: true,
        status: true,
        recurringStartDate: true,
        recurringEndDate: true,
        oneTimeDate: true,
        oneTimeDepartureTime: true,
        oneTimeArrivalTime: true,
        line: {
          select: {
            id: true,
            name: true,
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
        },
        daySchedules: {
          select: {
            dayOfWeek: true,
            stationTimes: {
              select: {
                stationId: true,
                orderIndex: true,
                time: true
              },
              orderBy: {
                orderIndex: 'asc'
              }
            }
          },
          orderBy: {
            dayOfWeek: 'asc'
          }
        },
        exceptions: {
          where: {
            exceptionDate: utcDate
          },
          select: {
            exceptionDate: true,
            type: true,
            departureTime: true,
            arrivalTime: true
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    const materialized = rides
      .flatMap((ride) => this.materializeRideInstancesForDate(ride, targetDate, targetDayOfWeek))
      .sort((a, b) => {
        if (a.departureTime !== b.departureTime) {
          return a.departureTime.localeCompare(b.departureTime);
        }

        if (a.arrivalTime !== b.arrivalTime) {
          return a.arrivalTime.localeCompare(b.arrivalTime);
        }

        if (a.line.name !== b.line.name) {
          return a.line.name.localeCompare(b.line.name);
        }

        return a.rideId.localeCompare(b.rideId);
      });

    const rideIds = [...new Set(materialized.map((instance) => instance.rideId))];
    const reservationCounts =
      rideIds.length > 0
        ? await this.prisma.reservation.groupBy({
            by: ['rideId', 'rideDepartureTime'],
            where: {
              tenantId: auth.tenantId,
              rideId: { in: rideIds },
              travelDate: utcDate,
              status: ReservationStatus.ACTIVE
            },
            _count: {
              _all: true
            }
          })
        : [];

    const reservationCountByInstance = new Map<string, number>(
      reservationCounts.map((item) => [
        `${item.rideId}:${item.rideDepartureTime}`,
        item._count._all
      ])
    );

    const items = materialized.map((instance) => {
      const reservationCount =
        reservationCountByInstance.get(`${instance.rideId}:${instance.departureTime}`) ?? 0;
      const availableSeats = Math.max(instance.capacity - reservationCount, 0);

      return {
        id: `${instance.rideId}:${instance.date}:${instance.departureTime}:${instance.source}`,
        rideId: instance.rideId,
        date: instance.date,
        departureTime: instance.departureTime,
        arrivalTime: instance.arrivalTime,
        source: instance.source,
        rideType: instance.rideType,
        status: instance.status,
        line: {
          id: instance.line.id,
          name: instance.line.name,
          departureStationId: instance.line.departureStationId,
          arrivalStationId: instance.line.arrivalStationId
        },
        availability: {
          capacity: instance.capacity,
          reservedSeats: reservationCount,
          availableSeats,
          hasAvailability: availableSeats > 0
        },
        reservationCount
      } satisfies RideInstanceResponseDto;
    });

    return {
      date: targetDate,
      timezoneOffsetMinutes,
      items
    };
  }

  async getById(auth: AccessTokenPayload, id: string): Promise<RideResponseDto> {
    const ride = await this.getRideOrThrow(auth.tenantId, id);
    return this.toRideResponse(ride);
  }

  async update(auth: AccessTokenPayload, id: string, dto: UpdateRideDto): Promise<RideResponseDto> {
    const existing = await this.getRideOrThrow(auth.tenantId, id);

    const nextType = dto.type ?? existing.type;
    const nextLineId = dto.lineId ?? existing.lineId;

    let nextLineName = existing.line.name;
    let nextRouteStationIds = [
      existing.line.departureStationId,
      ...existing.line.intermediateStops.map((item) => item.stationId),
      existing.line.arrivalStationId
    ];
    if (nextLineId !== existing.lineId) {
      const line = await this.ensureLineInTenant(auth.tenantId, nextLineId);
      nextLineName = line.name;
      nextRouteStationIds = line.routeStationIds;
    }

    const nextDaySchedules =
      dto.daySchedules !== undefined
        ? dto.daySchedules
        : existing.daySchedules.map((item) => ({
            dayOfWeek: item.dayOfWeek,
            stationTimes: item.stationTimes.map((stationTime) => ({
              stationId: stationTime.stationId,
              orderIndex: stationTime.orderIndex,
              time: stationTime.time ?? undefined
            }))
          }));

    const normalizedSchedule = this.normalizeAndValidateSchedule({
      type: nextType,
      routeStationIds: nextRouteStationIds,
      recurringStartDate:
        dto.recurringStartDate !== undefined
          ? dto.recurringStartDate
          : this.formatDate(existing.recurringStartDate),
      recurringEndDate:
        dto.recurringEndDate !== undefined ? dto.recurringEndDate : this.formatDate(existing.recurringEndDate),
      oneTimeDate: dto.oneTimeDate !== undefined ? dto.oneTimeDate : this.formatDate(existing.oneTimeDate),
      oneTimeDepartureTime:
        dto.oneTimeDepartureTime !== undefined
          ? dto.oneTimeDepartureTime
          : (existing.oneTimeDepartureTime ?? undefined),
      oneTimeArrivalTime:
        dto.oneTimeArrivalTime !== undefined
          ? dto.oneTimeArrivalTime
          : (existing.oneTimeArrivalTime ?? undefined),
      daySchedules: nextDaySchedules
    });

    const nextStatus = dto.status ?? existing.status;
    this.validateStatusTransition(existing.status, nextStatus);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.ride.update({
        where: {
          id
        },
        data: withUpdateAudit(
          {
            ...(typeof dto.name === 'string' ? { name: dto.name.trim() || nextLineName } : {}),
            ...(dto.lineId ? { lineId: dto.lineId } : {}),
            ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
            ...(dto.type ? { type: normalizedSchedule.type } : {}),
            ...(dto.status ? { status: dto.status } : {}),
            recurringStartDate: normalizedSchedule.recurringStartDate,
            recurringEndDate: normalizedSchedule.recurringEndDate,
            oneTimeDate: normalizedSchedule.oneTimeDate,
            oneTimeDepartureTime: normalizedSchedule.oneTimeDepartureTime,
            oneTimeArrivalTime: normalizedSchedule.oneTimeArrivalTime
          },
          auth.sub
        )
      });

      await this.replaceRideDaySchedulesTx(
        tx,
        auth.tenantId,
        id,
        auth.sub,
        normalizedSchedule.daySchedules,
        true
      );

      return tx.ride.findFirst({
        where: {
          id,
          tenantId: auth.tenantId
        },
        select: SAFE_RIDE_SELECT
      });
    });

    if (!updated) {
      throw new NotFoundException('Ride not found');
    }

    return this.toRideResponse(updated);
  }

  async replaceDayTimes(
    auth: AccessTokenPayload,
    id: string,
    daySchedules: RideDayScheduleInputDto[]
  ): Promise<RideResponseDto> {
    const ride = await this.getRideOrThrow(auth.tenantId, id);

    if (ride.type !== RideType.RECURRING) {
      throw new BadRequestException('Day-times can only be managed for recurring rides');
    }

    const routeStationIds = [
      ride.line.departureStationId,
      ...ride.line.intermediateStops.map((item) => item.stationId),
      ride.line.arrivalStationId
    ];

    this.validateDaySchedules(daySchedules, routeStationIds);

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.replaceRideDaySchedulesTx(tx, auth.tenantId, id, auth.sub, daySchedules, true);

      await tx.ride.update({
        where: { id },
        data: withUpdateAudit({}, auth.sub)
      });

      return tx.ride.findFirst({
        where: {
          id,
          tenantId: auth.tenantId
        },
        select: SAFE_RIDE_SELECT
      });
    });

    if (!updated) {
      throw new NotFoundException('Ride not found');
    }

    return this.toRideResponse(updated);
  }

  async addException(
    auth: AccessTokenPayload,
    rideId: string,
    dto: CreateRideExceptionDto
  ): Promise<RideExceptionResponseDto> {
    await this.getRideOrThrow(auth.tenantId, rideId);
    this.validateExceptionPayload(dto);

    const exceptionDate = this.parseDateOnly(dto.date);

    const existingOnDate = await this.prisma.rideException.findMany({
      where: {
        tenantId: auth.tenantId,
        rideId,
        exceptionDate
      },
      select: {
        id: true,
        type: true,
        departureTime: true,
        arrivalTime: true
      }
    });

    if (existingOnDate.some((item) => item.type !== dto.type)) {
      throw new ConflictException('Cannot mix SKIP and ADDITIONAL exceptions on the same date');
    }

    if (
      dto.type === RideExceptionType.ADDITIONAL &&
      existingOnDate.some(
        (item) => item.departureTime === dto.departureTime && item.arrivalTime === dto.arrivalTime
      )
    ) {
      throw new ConflictException('Additional exception with the same date and times already exists');
    }

    if (dto.type === RideExceptionType.SKIP && existingOnDate.length > 0) {
      throw new ConflictException('Skip exception for this date already exists');
    }

    const created = await this.prisma.rideException.create({
      data: withCreateAudit(
        {
          tenantId: auth.tenantId,
          rideId,
          exceptionDate,
          type: dto.type,
          departureTime: dto.type === RideExceptionType.ADDITIONAL ? dto.departureTime!.trim() : null,
          arrivalTime: dto.type === RideExceptionType.ADDITIONAL ? dto.arrivalTime!.trim() : null
        },
        auth.sub
      ),
      select: {
        id: true,
        exceptionDate: true,
        type: true,
        departureTime: true,
        arrivalTime: true,
        createdById: true,
        updatedById: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return this.toExceptionResponse(created);
  }

  async removeException(
    auth: AccessTokenPayload,
    rideId: string,
    exceptionId: string
  ): Promise<RideExceptionResponseDto> {
    await this.getRideOrThrow(auth.tenantId, rideId);

    const existing = await this.prisma.rideException.findFirst({
      where: {
        id: exceptionId,
        rideId,
        tenantId: auth.tenantId
      },
      select: {
        id: true
      }
    });

    if (!existing) {
      throw new NotFoundException('Ride exception not found');
    }

    const deleted = await this.prisma.rideException.delete({
      where: {
        id: exceptionId
      },
      select: {
        id: true,
        exceptionDate: true,
        type: true,
        departureTime: true,
        arrivalTime: true,
        createdById: true,
        updatedById: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return this.toExceptionResponse(deleted);
  }

  async remove(auth: AccessTokenPayload, id: string, cascade: boolean = false): Promise<RideResponseDto> {
    await this.getRideOrThrow(auth.tenantId, id);

    if (cascade) {
      return this.prisma.$transaction(async (tx) => {
        const now = new Date();

        await tx.reservation.updateMany({
          where: {
            tenantId: auth.tenantId,
            rideId: id,
            status: ReservationStatus.ACTIVE
          },
          data: {
            status: ReservationStatus.CANCELLED,
            cancelledAt: now,
            updatedById: auth.sub
          }
        });

        const deactivated = await tx.ride.update({
          where: {
            id
          },
          data: withUpdateAudit(
            {
              status: RideStatus.INACTIVE
            },
            auth.sub
          ),
          select: SAFE_RIDE_SELECT
        });

        return this.toRideResponse(deactivated);
      });
    }

    const activeReservationReferenceCount = await this.prisma.reservation.count({
      where: {
        tenantId: auth.tenantId,
        rideId: id,
        status: ReservationStatus.ACTIVE
      }
    });

    if (activeReservationReferenceCount > 0) {
      throw new ConflictException(
        'Ride cannot be deleted because it has active reservations. Use cascade=true to cancel reservations and deactivate ride.'
      );
    }

    const deactivated = await this.prisma.ride.update({
      where: {
        id
      },
      data: withUpdateAudit(
        {
          status: RideStatus.INACTIVE
        },
        auth.sub
      ),
      select: SAFE_RIDE_SELECT
    });

    return this.toRideResponse(deactivated);
  }

  private async getRideOrThrow(tenantId: string, id: string): Promise<SelectedRide> {
    const ride = await this.prisma.ride.findFirst({
      where: {
        id,
        tenantId
      },
      select: SAFE_RIDE_SELECT
    });

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    return ride;
  }

  private async ensureLineInTenant(
    tenantId: string,
    lineId: string
  ): Promise<{ id: string; name: string; routeStationIds: string[] }> {
    const line = await this.prisma.line.findFirst({
      where: {
        id: lineId,
        tenantId
      },
      select: {
        id: true,
        name: true,
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
    });

    if (!line) {
      throw new BadRequestException('Line must exist in the current tenant');
    }

    return {
      id: line.id,
      name: line.name,
      routeStationIds: [
        line.departureStationId,
        ...line.intermediateStops.map((item) => item.stationId),
        line.arrivalStationId
      ]
    };
  }

  private normalizeAndValidateSchedule(input: RideScheduleInput): RideScheduleNormalized {
    const daySchedules = input.daySchedules ?? [];
    this.validateDaySchedules(daySchedules, input.routeStationIds);

    const normalized: RideScheduleNormalized = {
      type: input.type,
      recurringStartDate: input.recurringStartDate ? this.parseDateOnly(input.recurringStartDate) : null,
      recurringEndDate: input.recurringEndDate ? this.parseDateOnly(input.recurringEndDate) : null,
      oneTimeDate: input.oneTimeDate ? this.parseDateOnly(input.oneTimeDate) : null,
      oneTimeDepartureTime: input.oneTimeDepartureTime?.trim() || null,
      oneTimeArrivalTime: input.oneTimeArrivalTime?.trim() || null,
      daySchedules
    };

    if (
      normalized.recurringStartDate &&
      normalized.recurringEndDate &&
      normalized.recurringEndDate < normalized.recurringStartDate
    ) {
      throw new BadRequestException('recurringEndDate must be greater than or equal to recurringStartDate');
    }

    if (normalized.type === RideType.RECURRING) {
      if (!normalized.recurringStartDate) {
        throw new BadRequestException('Recurring rides require recurringStartDate');
      }

      if (normalized.daySchedules.length === 0) {
        throw new BadRequestException('Recurring rides require at least one day schedule definition');
      }

      if (
        normalized.oneTimeDate ||
        normalized.oneTimeDepartureTime ||
        normalized.oneTimeArrivalTime
      ) {
        throw new BadRequestException(
          'Recurring rides cannot define one-time date or one-time departure/arrival times'
        );
      }

      return normalized;
    }

    if (!normalized.oneTimeDate || !normalized.oneTimeDepartureTime || !normalized.oneTimeArrivalTime) {
      throw new BadRequestException('One-time rides require oneTimeDate, oneTimeDepartureTime and oneTimeArrivalTime');
    }

    if (this.isZeroDurationTimeRange(normalized.oneTimeDepartureTime, normalized.oneTimeArrivalTime)) {
      throw new BadRequestException(
        'one-time departureTime and arrivalTime cannot be equal (overnight rides are allowed)'
      );
    }

      if (normalized.daySchedules.length > 0) {
        throw new BadRequestException('One-time rides cannot include recurring day schedules');
    }

    if (normalized.recurringStartDate || normalized.recurringEndDate) {
      throw new BadRequestException('One-time rides cannot define recurring dates');
    }

    return normalized;
  }

  private validateDaySchedules(daySchedules: RideDayScheduleInputDto[], routeStationIds: string[]): void {
    const daySet = new Set<number>();
    const stationSet = new Set(routeStationIds);
    const expectedOrderPairs = routeStationIds.map((stationId, index) => `${index}:${stationId}`);

    for (const schedule of daySchedules) {
      if (daySet.has(schedule.dayOfWeek)) {
        throw new BadRequestException('Duplicate dayOfWeek in day schedules is not allowed');
      }

      const sortedStationTimes = [...schedule.stationTimes].sort(
        (left, right) => left.orderIndex - right.orderIndex
      );

      if (sortedStationTimes.length > 0) {
        const routePairs = sortedStationTimes.map((item) => `${item.orderIndex}:${item.stationId}`);
        if (
          sortedStationTimes.length !== expectedOrderPairs.length ||
          routePairs.some((pair, index) => pair !== expectedOrderPairs[index])
        ) {
          throw new BadRequestException('Day schedule station order must match the selected line route');
        }

        const scheduleStationIds = new Set<string>();
        for (const stationTime of sortedStationTimes) {
          if (!stationSet.has(stationTime.stationId)) {
            throw new BadRequestException('Day schedule contains station outside of selected line route');
          }

          if (scheduleStationIds.has(stationTime.stationId)) {
            throw new BadRequestException('Duplicate stationId in day schedule is not allowed');
          }

          scheduleStationIds.add(stationTime.stationId);
        }

        const departureTime = sortedStationTimes[0].time?.trim();
        const arrivalTime = sortedStationTimes[sortedStationTimes.length - 1].time?.trim();

        if (departureTime && arrivalTime && this.isZeroDurationTimeRange(departureTime, arrivalTime)) {
          throw new BadRequestException(
            'day schedule departure and arrival times cannot be equal (overnight rides are allowed)'
          );
        }
      }

      daySet.add(schedule.dayOfWeek);
    }
  }

  private validateStatusTransition(currentStatus: RideStatus, nextStatus: RideStatus): void {
    if (currentStatus === nextStatus) {
      return;
    }

    if (currentStatus === RideStatus.DRAFT && nextStatus === RideStatus.ACTIVE) {
      return;
    }

    if (currentStatus === RideStatus.ACTIVE && nextStatus === RideStatus.INACTIVE) {
      return;
    }

    if (currentStatus === RideStatus.INACTIVE && nextStatus === RideStatus.ACTIVE) {
      return;
    }

    throw new BadRequestException(
      `Invalid ride status transition from ${currentStatus} to ${nextStatus}`
    );
  }

  private validateExceptionPayload(dto: CreateRideExceptionDto): void {
    if (dto.type === RideExceptionType.SKIP) {
      if (dto.departureTime || dto.arrivalTime) {
        throw new BadRequestException('SKIP exceptions cannot include departureTime or arrivalTime');
      }

      return;
    }

    if (!dto.departureTime || !dto.arrivalTime) {
      throw new BadRequestException('ADDITIONAL exceptions require departureTime and arrivalTime');
    }

    if (this.isZeroDurationTimeRange(dto.departureTime, dto.arrivalTime)) {
      throw new BadRequestException(
        'ADDITIONAL exception departureTime and arrivalTime cannot be equal (overnight rides are allowed)'
      );
    }
  }

  private isZeroDurationTimeRange(departureTime: string, arrivalTime: string): boolean {
    return departureTime.trim() === arrivalTime.trim();
  }

  private async replaceRideDaySchedulesTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    rideId: string,
    actorId: string,
    daySchedules: RideDayScheduleInputDto[],
    deleteExisting: boolean
  ): Promise<void> {
    if (deleteExisting) {
      await tx.rideDaySchedule.deleteMany({
        where: {
          rideId,
          tenantId
        }
      });
    }

    if (!daySchedules.length) {
      return;
    }

    for (const schedule of daySchedules) {
      await tx.rideDaySchedule.create({
        data: withCreateAudit(
          {
            tenantId,
            rideId,
            dayOfWeek: schedule.dayOfWeek,
            stationTimes: {
              create: schedule.stationTimes.map((stationTime) =>
                withCreateAudit(
                  {
                    tenantId,
                    stationId: stationTime.stationId,
                    orderIndex: stationTime.orderIndex,
                    time: stationTime.time?.trim() || null
                  },
                  actorId
                )
              )
            }
          },
          actorId
        )
      });
    }
  }

  private parseDateOnly(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private resolveUtcDateFromLocalDate(localDate: string): Date {
    const [year, month, day] = localDate.split('-').map((part) => Number(part));

    if (!year || !month || !day) {
      throw new BadRequestException('date must be in YYYY-MM-DD format');
    }

    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  }

  private getDayOfWeekFromDateString(value: string): number {
    const [year, month, day] = value.split('-').map((part) => Number(part));
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)).getUTCDay();
  }

  private materializeRideInstancesForDate(
    ride: RideWithInstanceMaterialization,
    targetDate: string,
    targetDayOfWeek: number
  ): MaterializedRideInstance[] {
    const baseInstances: MaterializedRideInstance[] = [];

    if (ride.type === RideType.RECURRING) {
      if (!ride.recurringStartDate) {
        return [];
      }

      const startDate = this.formatDate(ride.recurringStartDate)!;
      const endDate = ride.recurringEndDate ? this.formatDate(ride.recurringEndDate)! : null;

      const dateInRange = targetDate >= startDate && (!endDate || targetDate <= endDate);
      const daySchedule = ride.daySchedules.find((entry) => entry.dayOfWeek === targetDayOfWeek);
      const orderedStationTimes = daySchedule
        ? [...daySchedule.stationTimes].sort((left, right) => left.orderIndex - right.orderIndex)
        : [];
      const departureTime = orderedStationTimes[0]?.time ?? null;
      const arrivalTime = orderedStationTimes[orderedStationTimes.length - 1]?.time ?? null;

      if (dateInRange && departureTime && arrivalTime) {
        baseInstances.push({
          rideId: ride.id,
          date: targetDate,
          departureTime,
          arrivalTime,
          source: 'BASE',
          rideType: ride.type,
          status: ride.status,
          capacity: ride.capacity,
          line: {
            id: ride.line.id,
            name: ride.line.name,
            departureStationId: ride.line.departureStationId,
            arrivalStationId: ride.line.arrivalStationId
          }
        });
      }
    }

    if (ride.type === RideType.ONE_TIME) {
      const oneTimeDate = ride.oneTimeDate ? this.formatDate(ride.oneTimeDate) : null;

      if (
        oneTimeDate === targetDate &&
        ride.oneTimeDepartureTime &&
        ride.oneTimeArrivalTime
      ) {
        baseInstances.push({
          rideId: ride.id,
          date: targetDate,
          departureTime: ride.oneTimeDepartureTime,
          arrivalTime: ride.oneTimeArrivalTime,
          source: 'BASE',
          rideType: ride.type,
          status: ride.status,
          capacity: ride.capacity,
          line: {
            id: ride.line.id,
            name: ride.line.name,
            departureStationId: ride.line.departureStationId,
            arrivalStationId: ride.line.arrivalStationId
          }
        });
      }
    }

    const hasSkip = ride.exceptions.some((item) => item.type === RideExceptionType.SKIP);
    const additionalInstances: MaterializedRideInstance[] = ride.exceptions
      .filter((item) => item.type === RideExceptionType.ADDITIONAL)
      .filter((item) => Boolean(item.departureTime && item.arrivalTime))
      .map((item) => ({
        rideId: ride.id,
        date: targetDate,
        departureTime: item.departureTime!,
        arrivalTime: item.arrivalTime!,
        source: 'ADDITIONAL' as const,
        rideType: ride.type,
        status: ride.status,
        capacity: ride.capacity,
        line: {
          id: ride.line.id,
          name: ride.line.name,
          departureStationId: ride.line.departureStationId,
          arrivalStationId: ride.line.arrivalStationId
        }
      }));

    const effectiveBase = hasSkip ? [] : baseInstances;

    return [...effectiveBase, ...additionalInstances];
  }

  private formatDate(value: Date | null): string | undefined {
    if (!value) {
      return undefined;
    }

    return value.toISOString().slice(0, 10);
  }

  private toRideResponse(ride: SelectedRide): RideResponseDto {
    return {
      ...ride,
      recurringStartDate: this.formatDate(ride.recurringStartDate) ?? null,
      recurringEndDate: this.formatDate(ride.recurringEndDate) ?? null,
      oneTimeDate: this.formatDate(ride.oneTimeDate) ?? null,
      daySchedules: ride.daySchedules.map((item) => ({
        dayOfWeek: item.dayOfWeek,
        stationTimes: item.stationTimes.map((stationTime) => ({
          stationId: stationTime.stationId,
          orderIndex: stationTime.orderIndex,
          time: stationTime.time
        }))
      })),
      exceptions: ride.exceptions.map((item) => this.toExceptionResponse(item))
    };
  }

  private toExceptionResponse(exception: RideExceptionRecord): RideExceptionResponseDto {
    return {
      id: exception.id,
      date: this.formatDate(exception.exceptionDate)!,
      type: exception.type,
      departureTime: exception.departureTime,
      arrivalTime: exception.arrivalTime,
      createdById: exception.createdById,
      updatedById: exception.updatedById,
      createdAt: exception.createdAt,
      updatedAt: exception.updatedAt
    };
  }
}
