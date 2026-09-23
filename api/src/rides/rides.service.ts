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
import { scheduleEditTransaction } from '../prisma/schedule-lock';
import {
  NO_CONSENT,
  PROSPECTIVE_INVARIANTS,
  ProspectiveWriteConsent,
  guardProspectiveWrite
} from '../invariants/prospective-write';
import { consentFrom } from '../invariants/dto/confirm-breaking-change.dto';
import { CreateRideDto } from './dto/create-ride.dto';
import { ListRideInstancesQueryDto } from './dto/ride-instances.query.dto';
import { ListRidesQueryDto } from './dto/list-rides.query.dto';
import { RideDayScheduleInputDto } from './dto/ride-day-time.dto';
import { CreateRideExceptionDto, UpdateRideExceptionDto } from './dto/ride-exception.dto';
import {
  PaginatedRidesResponseDto,
  RideInstanceResponseDto,
  RideInstancesByDateResponseDto,
  RideExceptionResponseDto,
  RideResponseDto
} from './dto/ride.response.dto';
import {
  dayOfWeekOf,
  formatDateOnly,
  materializeInstanceTimesForDate,
  utcDateOf
} from './ride-instance-materialization';
import { UpdateRideDto } from './dto/update-ride.dto';
import { TotalRow } from '../prisma/total-row.type';

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
  // Retired weekdays and additional departures keep their rows for the
  // reservations that name them, but a ride no longer has them.
  daySchedules: {
    where: { retiredAt: null },
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
    where: { retiredAt: null },
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

const RIDE_EXCEPTION_SELECT = Prisma.validator<Prisma.RideExceptionSelect>()({
  id: true,
  // The domain audit extension attributes a create or update from the row the
  // write returns, and refuses one without a tenant. Left out, every exception
  // write rolls back with that refusal.
  tenantId: true,
  exceptionDate: true,
  type: true,
  departureTime: true,
  arrivalTime: true,
  createdById: true,
  updatedById: true,
  createdAt: true,
  updatedAt: true
});

type SelectedRide = Prisma.RideGetPayload<{ select: typeof SAFE_RIDE_SELECT }>;
type RideExceptionRecord = Prisma.RideExceptionGetPayload<{
  select: typeof RIDE_EXCEPTION_SELECT;
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

type RideDayScheduleMutableValues = TotalRow<
  Prisma.RideDayScheduleUncheckedCreateInput,
  | 'id'
  | 'tenantId'
  | 'rideId'
  | 'createdById'
  | 'updatedById'
  | 'createdAt'
  | 'updatedAt'
  | 'stationTimes'
  // Not an input: reconciliation decides it, restoring a returning weekday
  // and retiring a dropped one.
  | 'retiredAt'
  | 'reservations'
>;

type RideStationTimeMutableValues = TotalRow<
  Prisma.RideDayScheduleStationTimeUncheckedCreateInput,
  | 'id'
  | 'tenantId'
  | 'rideDayScheduleId'
  | 'createdById'
  | 'updatedById'
  | 'createdAt'
  | 'updatedAt'
>;

type TotalRideDaySchedule = RideDayScheduleMutableValues & {
  stationTimes: RideStationTimeMutableValues[];
};

@Injectable()
export class RidesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(auth: AccessTokenPayload, dto: CreateRideDto): Promise<RideResponseDto> {
    // The route the new schedule is validated against is read under the
    // schedule lock. Read before it, a line edit could realign every existing
    // ride and commit, leaving this one created against the old stop list.
    const created = await scheduleEditTransaction(this.prisma, auth.tenantId, async (tx) => {
      const line = await this.ensureLineInTenant(auth.tenantId, dto.lineId, tx);

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
          this.toTotalDaySchedules(normalizedSchedule.daySchedules)
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

  async list(
    auth: AccessTokenPayload,
    query: ListRidesQueryDto
  ): Promise<PaginatedRidesResponseDto> {
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

    // A ride's own status does not follow its line: deactivating a line does
    // not flip its rides to INACTIVE, so both facts are checked here. See
    // ride.lineActive for the case where they disagree.
    const rides = await this.prisma.ride.findMany({
      where: {
        tenantId: auth.tenantId,
        status: RideStatus.ACTIVE,
        line: { isActive: true }
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
          where: { retiredAt: null },
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
            exceptionDate: utcDate,
            retiredAt: null
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
    // Every field the DTO leaves out is filled in from the stored ride and
    // written back, so this is a read-modify-write and it belongs inside one
    // transaction. Read outside it, the merge is computed from a snapshot that
    // a concurrent edit can invalidate before this one writes, and that edit is
    // then overwritten with values read before it existed — a departure time
    // moved back, a capacity change undone, with nothing to show it happened.
    // Inside, the guard's exclusive schedule lock makes a second edit wait until
    // this one commits, and it then reads the ride this one wrote.
    const updated = await guardProspectiveWrite(
      this.prisma,
      { tenantId: auth.tenantId, actorId: auth.sub },
      PROSPECTIVE_INVARIANTS.rideUpdate,
      consentFrom(dto),
      async (
        tx,
        prepared: { nextLineName: string; normalizedSchedule: RideScheduleNormalized }
      ) => {
        const { nextLineName, normalizedSchedule } = prepared;

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
          this.toTotalDaySchedules(normalizedSchedule.daySchedules)
        );

        return tx.ride.findFirst({
          where: {
            id,
            tenantId: auth.tenantId
          },
          select: SAFE_RIDE_SELECT
        });
      },
      async (tx) => {
        const existing = await this.getRideOrThrow(auth.tenantId, id, tx);

        const nextType = dto.type ?? existing.type;
        const nextLineId = dto.lineId ?? existing.lineId;

        let nextLineName = existing.line.name;
        let nextRouteStationIds = [
          existing.line.departureStationId,
          ...existing.line.intermediateStops.map((item) => item.stationId),
          existing.line.arrivalStationId
        ];
        if (nextLineId !== existing.lineId) {
          const line = await this.ensureLineInTenant(auth.tenantId, nextLineId, tx);
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
            dto.recurringEndDate !== undefined
              ? dto.recurringEndDate
              : this.formatDate(existing.recurringEndDate),
          oneTimeDate:
            dto.oneTimeDate !== undefined ? dto.oneTimeDate : this.formatDate(existing.oneTimeDate),
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

        return { nextLineName, normalizedSchedule };
      }
    );

    if (!updated) {
      throw new NotFoundException('Ride not found');
    }

    return this.toRideResponse(updated);
  }

  async replaceDayTimes(
    auth: AccessTokenPayload,
    id: string,
    daySchedules: RideDayScheduleInputDto[],
    consent: ProspectiveWriteConsent = NO_CONSENT
  ): Promise<RideResponseDto> {
    // The route these times are checked against is read inside the write's own
    // transaction. Read before it, a line edit could land in between and leave
    // this call writing station times for stops the route no longer has —
    // validated against a route that stopped being true while the check was
    // still passing.
    const updated = await guardProspectiveWrite(
      this.prisma,
      { tenantId: auth.tenantId, actorId: auth.sub },
      PROSPECTIVE_INVARIANTS.rideUpdate,
      consent,
      async (tx) => {
        await this.replaceRideDaySchedulesTx(
          tx,
          auth.tenantId,
          id,
          auth.sub,
          this.toTotalDaySchedules(daySchedules)
        );

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
      },
      async (tx) => {
        const ride = await this.getRideOrThrow(auth.tenantId, id, tx);

        if (ride.type !== RideType.RECURRING) {
          throw new BadRequestException('Day-times can only be managed for recurring rides');
        }

        const routeStationIds = [
          ride.line.departureStationId,
          ...ride.line.intermediateStops.map((item) => item.stationId),
          ride.line.arrivalStationId
        ];

        this.validateDaySchedules(daySchedules, routeStationIds);
      }
    );

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

    const created = await guardProspectiveWrite(
      this.prisma,
      { tenantId: auth.tenantId, actorId: auth.sub },
      dto.type === RideExceptionType.SKIP ? PROSPECTIVE_INVARIANTS.rideException : [],
      consentFrom(dto),
      async (tx) => {
        // Inside the transaction, so the read that proves the exception is new
        // and the write that makes it exist cannot be separated. `RideException`
        // carries no unique constraint, so this read is the only thing standing
        // between two identical requests and two identical rows — which is what
        // the guard's exclusive schedule lock is for: the second request waits
        // for the first to commit, then this read finds the row it created.
        await this.ensureExceptionIsNew(tx, auth.tenantId, rideId, exceptionDate, dto);

        return tx.rideException.create({
          data: withCreateAudit(
            {
              tenantId: auth.tenantId,
              rideId,
              exceptionDate,
              type: dto.type,
              departureTime:
                dto.type === RideExceptionType.ADDITIONAL ? dto.departureTime!.trim() : null,
              arrivalTime:
                dto.type === RideExceptionType.ADDITIONAL ? dto.arrivalTime!.trim() : null
            },
            auth.sub
          ),
          select: RIDE_EXCEPTION_SELECT
        });
      }
    );

    return this.toExceptionResponse(created);
  }

  private async ensureExceptionIsNew(
    tx: Prisma.TransactionClient,
    tenantId: string,
    rideId: string,
    exceptionDate: Date,
    dto: CreateRideExceptionDto
  ): Promise<void> {
    // A retired additional departure no longer runs, so it neither conflicts
    // with a new exception nor makes one a duplicate.
    const existingOnDate = await tx.rideException.findMany({
      where: {
        tenantId,
        rideId,
        exceptionDate,
        retiredAt: null
      },
      select: {
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
      throw new ConflictException(
        'Additional exception with the same date and times already exists'
      );
    }

    if (dto.type === RideExceptionType.SKIP && existingOnDate.length > 0) {
      throw new ConflictException('Skip exception for this date already exists');
    }
  }

  async removeException(
    auth: AccessTokenPayload,
    rideId: string,
    exceptionId: string,
    consent: ProspectiveWriteConsent = NO_CONSENT
  ): Promise<RideExceptionResponseDto> {
    const removed = await guardProspectiveWrite(
      this.prisma,
      { tenantId: auth.tenantId, actorId: auth.sub },
      PROSPECTIVE_INVARIANTS.rideException,
      consent,
      (tx, existing: { type: RideExceptionType }) =>
        // An additional departure is something reservations are sold on, so
        // removing it retires it: the ID they name keeps existing, and adding
        // the same times back later is a different departure. A SKIP names
        // nothing and is still deleted.
        existing.type === RideExceptionType.ADDITIONAL
          ? tx.rideException.update({
              where: { id: exceptionId },
              data: withUpdateAudit({ retiredAt: new Date() }, auth.sub),
              select: RIDE_EXCEPTION_SELECT
            })
          : tx.rideException.delete({
              where: { id: exceptionId },
              select: RIDE_EXCEPTION_SELECT
            }),
      (tx) => this.getLiveExceptionOrThrow(tx, auth.tenantId, rideId, exceptionId)
    );

    return this.toExceptionResponse(removed);
  }

  /**
   * Moves an additional departure to new times without changing which
   * departure it is.
   *
   * Removing it and adding one at the new times would hand every reservation
   * on it a departure that no longer exists. Edited in place, the ID those
   * reservations name stays, and their display copies of the times follow.
   */
  async updateException(
    auth: AccessTokenPayload,
    rideId: string,
    exceptionId: string,
    dto: UpdateRideExceptionDto
  ): Promise<RideExceptionResponseDto> {
    const departureTime = dto.departureTime.trim();
    const arrivalTime = dto.arrivalTime.trim();

    if (this.isZeroDurationTimeRange(departureTime, arrivalTime)) {
      throw new BadRequestException(
        'ADDITIONAL exception departureTime and arrivalTime cannot be equal (overnight rides are allowed)'
      );
    }

    const updated = await guardProspectiveWrite(
      this.prisma,
      { tenantId: auth.tenantId, actorId: auth.sub },
      PROSPECTIVE_INVARIANTS.rideExceptionEdit,
      consentFrom(dto),
      async (tx) => {
        const exception = await tx.rideException.update({
          where: { id: exceptionId },
          data: withUpdateAudit({ departureTime, arrivalTime }, auth.sub),
          select: RIDE_EXCEPTION_SELECT
        });

        // Only reservations that name this departure. One that merely shares
        // its old time is a legacy row, and moving it would be a guess.
        await tx.reservation.updateMany({
          where: {
            tenantId: auth.tenantId,
            rideExceptionId: exceptionId,
            status: ReservationStatus.ACTIVE
          },
          data: {
            rideDepartureTime: departureTime,
            rideArrivalTime: arrivalTime,
            updatedById: auth.sub
          }
        });

        return exception;
      },
      async (tx) => {
        const existing = await this.getLiveExceptionOrThrow(tx, auth.tenantId, rideId, exceptionId);

        if (existing.type !== RideExceptionType.ADDITIONAL) {
          throw new BadRequestException('Only ADDITIONAL exceptions have times to edit');
        }

        const duplicate = await tx.rideException.findFirst({
          where: {
            tenantId: auth.tenantId,
            rideId,
            exceptionDate: existing.exceptionDate,
            type: RideExceptionType.ADDITIONAL,
            retiredAt: null,
            departureTime,
            arrivalTime,
            id: { not: exceptionId }
          },
          select: { id: true }
        });

        if (duplicate) {
          throw new ConflictException(
            'Additional exception with the same date and times already exists'
          );
        }
      }
    );

    return this.toExceptionResponse(updated);
  }

  /** A retired exception is gone as far as the ride is concerned. */
  private async getLiveExceptionOrThrow(
    client: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    rideId: string,
    exceptionId: string
  ): Promise<{ type: RideExceptionType; exceptionDate: Date }> {
    await this.getRideOrThrow(tenantId, rideId, client);

    const existing = await client.rideException.findFirst({
      where: {
        id: exceptionId,
        rideId,
        tenantId,
        retiredAt: null
      },
      select: {
        type: true,
        exceptionDate: true
      }
    });

    if (!existing) {
      throw new NotFoundException('Ride exception not found');
    }

    return existing;
  }

  async remove(
    auth: AccessTokenPayload,
    id: string,
    cascade: boolean = false
  ): Promise<RideResponseDto> {
    await this.getRideOrThrow(auth.tenantId, id);

    if (cascade) {
      // Cancelling every reservation and retiring the ride is a schedule edit:
      // a booking still in flight must land before the cancellation sweeps it.
      return scheduleEditTransaction(this.prisma, auth.tenantId, async (tx) => {
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

    // The count and the deactivation are one schedule edit. Counted outside
    // the lock, a booking still in flight is invisible, and the ride would be
    // retired under a passenger who was just sold a seat on it.
    return scheduleEditTransaction(this.prisma, auth.tenantId, async (tx) => {
      const activeReservationReferenceCount = await tx.reservation.count({
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

  /**
   * `client` defaults to the unguarded connection, but a caller that is going
   * to write what it reads passes its transaction instead: the read then happens
   * under that transaction's schedule lock, so a concurrent edit waits rather
   * than being quietly overwritten.
   */
  private async getRideOrThrow(
    tenantId: string,
    id: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma
  ): Promise<SelectedRide> {
    const ride = await client.ride.findFirst({
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
    lineId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma
  ): Promise<{ id: string; name: string; routeStationIds: string[] }> {
    const line = await client.line.findFirst({
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
      recurringStartDate: input.recurringStartDate
        ? this.parseDateOnly(input.recurringStartDate)
        : null,
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
      throw new BadRequestException(
        'recurringEndDate must be greater than or equal to recurringStartDate'
      );
    }

    if (normalized.type === RideType.RECURRING) {
      if (!normalized.recurringStartDate) {
        throw new BadRequestException('Recurring rides require recurringStartDate');
      }

      if (normalized.daySchedules.length === 0) {
        throw new BadRequestException(
          'Recurring rides require at least one day schedule definition'
        );
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

    if (
      !normalized.oneTimeDate ||
      !normalized.oneTimeDepartureTime ||
      !normalized.oneTimeArrivalTime
    ) {
      throw new BadRequestException(
        'One-time rides require oneTimeDate, oneTimeDepartureTime and oneTimeArrivalTime'
      );
    }

    if (
      this.isZeroDurationTimeRange(normalized.oneTimeDepartureTime, normalized.oneTimeArrivalTime)
    ) {
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

  private validateDaySchedules(
    daySchedules: RideDayScheduleInputDto[],
    routeStationIds: string[]
  ): void {
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
          throw new BadRequestException(
            'Day schedule station order must match the selected line route'
          );
        }

        const scheduleStationIds = new Set<string>();
        for (const stationTime of sortedStationTimes) {
          if (!stationSet.has(stationTime.stationId)) {
            throw new BadRequestException(
              'Day schedule contains station outside of selected line route'
            );
          }

          if (scheduleStationIds.has(stationTime.stationId)) {
            throw new BadRequestException('Duplicate stationId in day schedule is not allowed');
          }

          scheduleStationIds.add(stationTime.stationId);
        }

        const departureTime = sortedStationTimes[0].time?.trim();
        const arrivalTime = sortedStationTimes[sortedStationTimes.length - 1].time?.trim();

        if (
          departureTime &&
          arrivalTime &&
          this.isZeroDurationTimeRange(departureTime, arrivalTime)
        ) {
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
        throw new BadRequestException(
          'SKIP exceptions cannot include departureTime or arrivalTime'
        );
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

  /**
   * Makes a ride's live weekdays exactly `daySchedules`, keeping every
   * weekday's row and ID.
   *
   * Reservations name the weekday they were sold on, so a row is never
   * deleted: a weekday that stays keeps its row, one that is dropped is
   * retired, and one that comes back restores the same row it had, which
   * `@@unique([rideId, dayOfWeek])` guarantees is the only one there is.
   * Changing a ride to one-time passes no weekdays and so retires them all.
   *
   * Station times are replaced under the kept row by deleting and recreating
   * them, as realignment does: (schedule, orderIndex) is unique, so updating
   * them in place would collide partway through a reorder.
   */
  private async replaceRideDaySchedulesTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    rideId: string,
    actorId: string,
    daySchedules: TotalRideDaySchedule[]
  ): Promise<void> {
    const existing = await tx.rideDaySchedule.findMany({
      where: { rideId, tenantId },
      select: { id: true, dayOfWeek: true, retiredAt: true }
    });
    const existingByDay = new Map(existing.map((row) => [row.dayOfWeek, row]));
    const keptDays = new Set(daySchedules.map((schedule) => schedule.dayOfWeek));

    const toRetire = existing.filter(
      (row) => row.retiredAt === null && !keptDays.has(row.dayOfWeek)
    );
    if (toRetire.length > 0) {
      await tx.rideDaySchedule.updateMany({
        where: { id: { in: toRetire.map((row) => row.id) }, tenantId },
        data: withUpdateAudit({ retiredAt: new Date() }, actorId)
      });
    }

    // Both rows are spread, not named: the two value types are total over
    // their mutable columns, so a new column reaches the database instead of
    // silently taking its default here.
    for (const { stationTimes, ...scheduleValues } of daySchedules) {
      const kept = existingByDay.get(scheduleValues.dayOfWeek);

      if (!kept) {
        await tx.rideDaySchedule.create({
          data: withCreateAudit(
            {
              tenantId,
              rideId,
              ...scheduleValues,
              stationTimes: {
                create: stationTimes.map((stationTime) =>
                  withCreateAudit({ tenantId, ...stationTime }, actorId)
                )
              }
            },
            actorId
          )
        });
        continue;
      }

      await tx.rideDaySchedule.update({
        where: { id: kept.id },
        data: withUpdateAudit({ ...scheduleValues, retiredAt: null }, actorId)
      });
      await tx.rideDayScheduleStationTime.deleteMany({
        where: { rideDayScheduleId: kept.id, tenantId }
      });
      if (stationTimes.length > 0) {
        await tx.rideDayScheduleStationTime.createMany({
          data: stationTimes.map((stationTime) =>
            withCreateAudit({ tenantId, rideDayScheduleId: kept.id, ...stationTime }, actorId)
          )
        });
      }
    }
  }

  private toTotalDaySchedules(daySchedules: RideDayScheduleInputDto[]): TotalRideDaySchedule[] {
    return daySchedules.map((schedule) => ({
      dayOfWeek: schedule.dayOfWeek,
      stationTimes: schedule.stationTimes.map((stationTime) => ({
        stationId: stationTime.stationId,
        orderIndex: stationTime.orderIndex,
        time: stationTime.time?.trim() || null
      }))
    }));
  }

  private parseDateOnly(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private resolveUtcDateFromLocalDate(localDate: string): Date {
    const [year, month, day] = localDate.split('-').map((part) => Number(part));

    if (!year || !month || !day) {
      throw new BadRequestException('date must be in YYYY-MM-DD format');
    }

    return utcDateOf(localDate);
  }

  private getDayOfWeekFromDateString(value: string): number {
    return dayOfWeekOf(value);
  }

  private materializeRideInstancesForDate(
    ride: RideWithInstanceMaterialization,
    targetDate: string,
    targetDayOfWeek: number
  ): MaterializedRideInstance[] {
    return materializeInstanceTimesForDate(ride, ride.exceptions, targetDate, targetDayOfWeek).map(
      (times) => ({
        rideId: ride.id,
        date: targetDate,
        departureTime: times.departureTime,
        arrivalTime: times.arrivalTime,
        source: times.source,
        rideType: ride.type,
        status: ride.status,
        capacity: ride.capacity,
        line: {
          id: ride.line.id,
          name: ride.line.name,
          departureStationId: ride.line.departureStationId,
          arrivalStationId: ride.line.arrivalStationId
        }
      })
    );
  }

  private formatDate(value: Date | null): string | undefined {
    return formatDateOnly(value);
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

  private toExceptionResponse(
    exception: Omit<RideExceptionRecord, 'tenantId'>
  ): RideExceptionResponseDto {
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
