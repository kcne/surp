import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma, RideExceptionType, RideStatus, RideType } from '@prisma/client';
import { AccessTokenPayload } from '../auth/auth.types';
import { withCreateAudit, withUpdateAudit } from '../prisma/audit-write.helper';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, resolvePagination } from '../prisma/repository-helpers';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRideDto } from './dto/create-ride.dto';
import { ListRidesQueryDto } from './dto/list-rides.query.dto';
import { RideDayTimeInputDto } from './dto/ride-day-time.dto';
import { CreateRideExceptionDto } from './dto/ride-exception.dto';
import {
  PaginatedRidesResponseDto,
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
      arrivalStationId: true
    }
  },
  dayTimes: {
    select: {
      dayOfWeek: true,
      departureTime: true,
      arrivalTime: true
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

type RideScheduleInput = {
  type: RideType;
  recurringStartDate: string | undefined;
  recurringEndDate: string | undefined;
  oneTimeDate: string | undefined;
  oneTimeDepartureTime: string | undefined;
  oneTimeArrivalTime: string | undefined;
  dayTimes: RideDayTimeInputDto[] | undefined;
};

type RideScheduleNormalized = {
  type: RideType;
  recurringStartDate: Date | null;
  recurringEndDate: Date | null;
  oneTimeDate: Date | null;
  oneTimeDepartureTime: string | null;
  oneTimeArrivalTime: string | null;
  dayTimes: RideDayTimeInputDto[];
};

@Injectable()
export class RidesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(auth: AccessTokenPayload, dto: CreateRideDto): Promise<RideResponseDto> {
    const line = await this.ensureLineInTenant(auth.tenantId, dto.lineId);

    const normalizedSchedule = this.normalizeAndValidateSchedule({
      type: dto.type,
      recurringStartDate: dto.recurringStartDate,
      recurringEndDate: dto.recurringEndDate,
      oneTimeDate: dto.oneTimeDate,
      oneTimeDepartureTime: dto.oneTimeDepartureTime,
      oneTimeArrivalTime: dto.oneTimeArrivalTime,
      dayTimes: dto.dayTimes
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

      if (normalizedSchedule.dayTimes.length > 0) {
        await this.replaceRideDayTimesTx(
          tx,
          auth.tenantId,
          createdRide.id,
          auth.sub,
          normalizedSchedule.dayTimes,
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

  async getById(auth: AccessTokenPayload, id: string): Promise<RideResponseDto> {
    const ride = await this.getRideOrThrow(auth.tenantId, id);
    return this.toRideResponse(ride);
  }

  async update(auth: AccessTokenPayload, id: string, dto: UpdateRideDto): Promise<RideResponseDto> {
    const existing = await this.getRideOrThrow(auth.tenantId, id);

    const nextType = dto.type ?? existing.type;
    const nextLineId = dto.lineId ?? existing.lineId;

    let nextLineName = existing.line.name;
    if (nextLineId !== existing.lineId) {
      const line = await this.ensureLineInTenant(auth.tenantId, nextLineId);
      nextLineName = line.name;
    }

    const nextDayTimes =
      dto.dayTimes !== undefined
        ? dto.dayTimes
        : existing.dayTimes.map((item) => ({
            dayOfWeek: item.dayOfWeek,
            departureTime: item.departureTime,
            arrivalTime: item.arrivalTime
          }));

    const normalizedSchedule = this.normalizeAndValidateSchedule({
      type: nextType,
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
      dayTimes: nextDayTimes
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

      await this.replaceRideDayTimesTx(
        tx,
        auth.tenantId,
        id,
        auth.sub,
        normalizedSchedule.dayTimes,
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
    dayTimes: RideDayTimeInputDto[]
  ): Promise<RideResponseDto> {
    const ride = await this.getRideOrThrow(auth.tenantId, id);

    if (ride.type !== RideType.RECURRING) {
      throw new BadRequestException('Day-times can only be managed for recurring rides');
    }

    this.validateDayTimes(dayTimes);

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.replaceRideDayTimesTx(tx, auth.tenantId, id, auth.sub, dayTimes, true);

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

  async remove(auth: AccessTokenPayload, id: string): Promise<RideResponseDto> {
    await this.getRideOrThrow(auth.tenantId, id);

    const deleted = await this.prisma.ride.delete({
      where: {
        id
      },
      select: SAFE_RIDE_SELECT
    });

    return this.toRideResponse(deleted);
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
  ): Promise<{ id: string; name: string }> {
    const line = await this.prisma.line.findFirst({
      where: {
        id: lineId,
        tenantId
      },
      select: {
        id: true,
        name: true
      }
    });

    if (!line) {
      throw new BadRequestException('Line must exist in the current tenant');
    }

    return line;
  }

  private normalizeAndValidateSchedule(input: RideScheduleInput): RideScheduleNormalized {
    const dayTimes = input.dayTimes ?? [];
    this.validateDayTimes(dayTimes);

    const normalized: RideScheduleNormalized = {
      type: input.type,
      recurringStartDate: input.recurringStartDate ? this.parseDateOnly(input.recurringStartDate) : null,
      recurringEndDate: input.recurringEndDate ? this.parseDateOnly(input.recurringEndDate) : null,
      oneTimeDate: input.oneTimeDate ? this.parseDateOnly(input.oneTimeDate) : null,
      oneTimeDepartureTime: input.oneTimeDepartureTime?.trim() || null,
      oneTimeArrivalTime: input.oneTimeArrivalTime?.trim() || null,
      dayTimes
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

      if (normalized.dayTimes.length === 0) {
        throw new BadRequestException('Recurring rides require at least one day-time definition');
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

    if (normalized.dayTimes.length > 0) {
      throw new BadRequestException('One-time rides cannot include recurring day-times');
    }

    if (normalized.recurringStartDate || normalized.recurringEndDate) {
      throw new BadRequestException('One-time rides cannot define recurring dates');
    }

    return normalized;
  }

  private validateDayTimes(dayTimes: RideDayTimeInputDto[]): void {
    const daySet = new Set<number>();

    for (const dayTime of dayTimes) {
      if (daySet.has(dayTime.dayOfWeek)) {
        throw new BadRequestException('Duplicate dayOfWeek in day-times is not allowed');
      }

      if (dayTime.departureTime >= dayTime.arrivalTime) {
        throw new BadRequestException('day-time departureTime must be before arrivalTime');
      }

      daySet.add(dayTime.dayOfWeek);
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

    if (dto.departureTime >= dto.arrivalTime) {
      throw new BadRequestException('ADDITIONAL exception departureTime must be before arrivalTime');
    }
  }

  private async replaceRideDayTimesTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    rideId: string,
    actorId: string,
    dayTimes: RideDayTimeInputDto[],
    deleteExisting: boolean
  ): Promise<void> {
    if (deleteExisting) {
      await tx.rideDayTime.deleteMany({
        where: {
          rideId,
          tenantId
        }
      });
    }

    if (!dayTimes.length) {
      return;
    }

    await tx.rideDayTime.createMany({
      data: dayTimes.map((dayTime) =>
        withCreateAudit(
          {
            tenantId,
            rideId,
            dayOfWeek: dayTime.dayOfWeek,
            departureTime: dayTime.departureTime.trim(),
            arrivalTime: dayTime.arrivalTime.trim()
          },
          actorId
        )
      )
    });
  }

  private parseDateOnly(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
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
      dayTimes: ride.dayTimes.map((item) => ({
        dayOfWeek: item.dayOfWeek,
        departureTime: item.departureTime,
        arrivalTime: item.arrivalTime
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
