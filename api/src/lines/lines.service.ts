import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { LineDirection, LineDirectionMode, Prisma, ReservationStatus, RideStatus } from '@prisma/client';
import { AccessTokenPayload } from '../auth/auth.types';
import { withCreateAudit, withUpdateAudit } from '../prisma/audit-write.helper';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, resolvePagination } from '../prisma/repository-helpers';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLineDto } from './dto/create-line.dto';
import { LineResponseDto, PaginatedLinesResponseDto } from './dto/line.response.dto';
import { LineStopInputDto } from './dto/line-stop.dto';
import { ListLinesQueryDto } from './dto/list-lines.query.dto';
import { UpdateLineDto } from './dto/update-line.dto';
import {
  isScheduleAlignedToRoute,
  realignDaySchedulesTx,
  type DayScheduleRealignInput
} from '../rides/ride-schedule-alignment';

const SAFE_LINE_SELECT = {
  id: true,
  tenantId: true,
  createdById: true,
  updatedById: true,
  name: true,
  departureStationId: true,
  arrivalStationId: true,
  directionMode: true,
  direction: true,
  pairKey: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  departureStation: {
    select: {
      id: true,
      name: true,
      address: true,
      category: true,
      isActive: true
    }
  },
  arrivalStation: {
    select: {
      id: true,
      name: true,
      address: true,
      category: true,
      isActive: true
    }
  },
  intermediateStops: {
    select: {
      stationId: true,
      orderIndex: true,
      isBoarding: true,
      isDropoff: true,
      station: {
        select: {
          name: true
        }
      }
    },
    orderBy: {
      orderIndex: 'asc' as const
    }
  }
} as const;

type SelectedLine = Prisma.LineGetPayload<{ select: typeof SAFE_LINE_SELECT }>;

type LineWithStops = {
  id: string;
  name: string;
  departureStationId: string;
  arrivalStationId: string;
  directionMode: LineDirectionMode;
  direction: LineDirection;
  pairKey: string | null;
  isActive: boolean;
  intermediateStops: Array<{
    stationId: string;
    orderIndex: number;
    isBoarding: boolean;
    isDropoff: boolean;
  }>;
};

/**
 * An intermediate stop with its boarding rules resolved.
 *
 * `LineStopInputDto` leaves the flags optional so existing clients keep working;
 * everything past `resolveIntermediateStops` works with explicit values.
 */
type ResolvedLineStop = {
  stationId: string;
  orderIndex: number;
  isBoarding: boolean;
  isDropoff: boolean;
};

@Injectable()
export class LinesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(auth: AccessTokenPayload, dto: CreateLineDto): Promise<LineResponseDto> {
    const stations = await this.ensureRouteStationsInTenant(
      auth.tenantId,
      dto.departureStationId,
      dto.arrivalStationId
    );

    const intermediateStops = await this.resolveIntermediateStops(
      auth.tenantId,
      dto.departureStationId,
      dto.arrivalStationId,
      dto.intermediateStops ?? []
    );

    const directionMode = dto.directionMode ?? LineDirectionMode.BOTH;
    const direction = dto.direction ?? LineDirection.OUTBOUND;
    const pairKey = this.normalizePairKey(dto.pairKey);
    const shouldAutoCreateReverse =
      directionMode === LineDirectionMode.BOTH && direction === LineDirection.OUTBOUND;

    this.validateDirectionMetadata(directionMode, direction, pairKey);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const createdLine = await tx.line.create({
          data: withCreateAudit(
            {
              tenantId: auth.tenantId,
              name: dto.name?.trim() || `${stations.departure.name} - ${stations.arrival.name}`,
              departureStationId: dto.departureStationId,
              arrivalStationId: dto.arrivalStationId,
              directionMode,
              direction,
              pairKey,
              isActive: dto.isActive ?? true
            },
            auth.sub
          ),
          select: {
            id: true
          }
        });

        await this.replaceLineStopsTx(
          tx,
          auth.tenantId,
          createdLine.id,
          auth.sub,
          intermediateStops,
          false
        );

        if (shouldAutoCreateReverse) {
          const effectivePairKey = pairKey ?? `pair-${createdLine.id}`;

          if (!pairKey) {
            await tx.line.update({
              where: {
                id: createdLine.id
              },
              data: withUpdateAudit(
                {
                  pairKey: effectivePairKey
                },
                auth.sub
              )
            });
          }

          const reverseLine = await tx.line.create({
            data: withCreateAudit(
              {
                tenantId: auth.tenantId,
                name: `${stations.arrival.name} - ${stations.departure.name}`,
                departureStationId: dto.arrivalStationId,
                arrivalStationId: dto.departureStationId,
                directionMode: LineDirectionMode.BOTH,
                direction: LineDirection.RETURN,
                pairKey: effectivePairKey,
                isActive: dto.isActive ?? true
              },
              auth.sub
            ),
            select: {
              id: true
            }
          });

          const reversedStops = this.buildReversedStops(intermediateStops);

          await this.replaceLineStopsTx(
            tx,
            auth.tenantId,
            reverseLine.id,
            auth.sub,
            reversedStops,
            false
          );
        }

        return tx.line.findFirst({
          where: {
            id: createdLine.id,
            tenantId: auth.tenantId
          },
          select: SAFE_LINE_SELECT
        });
      });

      if (!created) {
        throw new NotFoundException('Line not found');
      }

      return this.toLineResponse(created);
    } catch (error) {
      this.throwIfLineStopUniqueConstraint(error);
      throw error;
    }
  }

  async list(auth: AccessTokenPayload, query: ListLinesQueryDto): Promise<PaginatedLinesResponseDto> {
    const pagination = resolvePagination(query.page, query.pageSize);
    const term = query.search?.trim();

    const where = {
      tenantId: auth.tenantId,
      ...(typeof query.isActive === 'boolean' ? { isActive: query.isActive } : {}),
      ...(query.directionMode ? { directionMode: query.directionMode } : {}),
      ...(query.direction ? { direction: query.direction } : {}),
      ...(term
        ? {
            OR: [
              { name: { contains: term, mode: 'insensitive' as const } },
              { departureStation: { name: { contains: term, mode: 'insensitive' as const } } },
              { arrivalStation: { name: { contains: term, mode: 'insensitive' as const } } }
            ]
          }
        : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.line.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ createdAt: 'desc' }],
        select: SAFE_LINE_SELECT
      }),
      this.prisma.line.count({ where })
    ]);

    return {
      items: items.map((item) => this.toLineResponse(item)),
      total,
      page: pagination.page ?? DEFAULT_PAGE,
      pageSize: pagination.pageSize ?? DEFAULT_PAGE_SIZE
    };
  }

  async getById(auth: AccessTokenPayload, id: string): Promise<LineResponseDto> {
    const line = await this.getLineOrThrow(auth.tenantId, id);
    return this.toLineResponse(line as SelectedLine);
  }

  async update(auth: AccessTokenPayload, id: string, dto: UpdateLineDto): Promise<LineResponseDto> {
    const existing = await this.getLineOrThrow(auth.tenantId, id);
    const nextNameInput = dto.name;
    const hasNameUpdate = typeof nextNameInput === 'string';
    const resolvedName = hasNameUpdate ? nextNameInput.trim() || existing.name : existing.name;

    const departureStationId = dto.departureStationId ?? existing.departureStationId;
    const arrivalStationId = dto.arrivalStationId ?? existing.arrivalStationId;

    const stations = await this.ensureRouteStationsInTenant(
      auth.tenantId,
      departureStationId,
      arrivalStationId
    );

    const nextStops =
      dto.intermediateStops !== undefined
        ? await this.resolveIntermediateStops(
            auth.tenantId,
            departureStationId,
            arrivalStationId,
            dto.intermediateStops
          )
        : existing.intermediateStops;

    this.ensureStopsDoNotUseRouteEndpoints(departureStationId, arrivalStationId, nextStops);

    const directionMode = dto.directionMode ?? existing.directionMode;
    const direction = dto.direction ?? existing.direction;
    const pairKey =
      dto.pairKey !== undefined ? this.normalizePairKey(dto.pairKey) : (existing.pairKey ?? null);

    this.validateDirectionMetadata(directionMode, direction, pairKey);

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.line.update({
          where: {
            id
          },
          data: withUpdateAudit(
            {
              ...(hasNameUpdate ? { name: resolvedName } : {}),
              ...(dto.departureStationId ? { departureStationId: dto.departureStationId } : {}),
              ...(dto.arrivalStationId ? { arrivalStationId: dto.arrivalStationId } : {}),
              ...(dto.directionMode ? { directionMode: dto.directionMode } : {}),
              ...(dto.direction ? { direction: dto.direction } : {}),
              ...(dto.pairKey !== undefined ? { pairKey } : {}),
              ...(typeof dto.isActive === 'boolean' ? { isActive: dto.isActive } : {}),
              ...(dto.name === undefined && (dto.departureStationId || dto.arrivalStationId)
                ? { name: `${stations.departure.name} - ${stations.arrival.name}` }
                : {})
            },
            auth.sub
          )
        });

        // Keep paired directions aligned with route direction labels.
        if (hasNameUpdate && existing.directionMode === LineDirectionMode.BOTH && existing.pairKey) {
          const reverseDirectionalName = `${stations.arrival.name} - ${stations.departure.name}`;

          await tx.line.updateMany({
            where: {
              tenantId: auth.tenantId,
              pairKey: existing.pairKey,
              id: {
                not: id
              }
            },
            data: withUpdateAudit(
              {
                name: reverseDirectionalName
              },
              auth.sub
            )
          });
        }

        if (dto.intermediateStops !== undefined) {
          await this.replaceLineStopsTx(tx, auth.tenantId, id, auth.sub, nextStops, true);

          // A BOTH pair describes one route in two directions, so a stop added
          // here belongs on the opposite direction as well.
          if (directionMode === LineDirectionMode.BOTH && pairKey) {
            await this.syncPairedLineStopsTx(tx, auth.tenantId, id, auth.sub, pairKey, nextStops);
          }
        }

        // Any route change invalidates the day schedules of rides on this line,
        // so realign them in the same transaction that changed the route.
        const routeChanged =
          dto.intermediateStops !== undefined ||
          Boolean(dto.departureStationId) ||
          Boolean(dto.arrivalStationId);

        if (routeChanged) {
          const nextRouteStationIds = [
            departureStationId,
            ...[...nextStops]
              .sort((left, right) => left.orderIndex - right.orderIndex)
              .map((stop) => stop.stationId),
            arrivalStationId
          ];

          await this.reconcileRideDaySchedulesToRouteTx(
            tx,
            auth.tenantId,
            id,
            auth.sub,
            nextRouteStationIds
          );
        }

        return tx.line.findFirst({
          where: {
            id,
            tenantId: auth.tenantId
          },
          select: SAFE_LINE_SELECT
        });
      });

      if (!updated) {
        throw new NotFoundException('Line not found');
      }

      return this.toLineResponse(updated);
    } catch (error) {
      this.throwIfLineStopUniqueConstraint(error);
      throw error;
    }
  }

  async replaceStops(
    auth: AccessTokenPayload,
    id: string,
    intermediateStops: LineStopInputDto[]
  ): Promise<LineResponseDto> {
    return this.update(auth, id, { intermediateStops });
  }

  async createReverse(auth: AccessTokenPayload, id: string): Promise<LineResponseDto> {
    const source = await this.getLineOrThrow(auth.tenantId, id);

    const reversedStops: LineStopInputDto[] = this.buildReversedStops(source.intermediateStops);

    const targetStopSequence = reversedStops.map((stop) => stop.stationId);

    const candidates = await this.prisma.line.findMany({
      where: {
        tenantId: auth.tenantId,
        departureStationId: source.arrivalStationId,
        arrivalStationId: source.departureStationId
      },
      select: {
        id: true,
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

    const reverseAlreadyExists = candidates.some((candidate) => {
      const candidateSequence = candidate.intermediateStops.map((stop) => stop.stationId);
      if (candidateSequence.length !== targetStopSequence.length) {
        return false;
      }

      return candidateSequence.every((stationId, index) => stationId === targetStopSequence[index]);
    });

    if (reverseAlreadyExists) {
      throw new ConflictException('Reverse line already exists for this route');
    }

    const reverseDirectionMode =
      source.directionMode === LineDirectionMode.BOTH ? LineDirectionMode.BOTH : LineDirectionMode.SINGLE;
    const reverseDirection =
      source.directionMode === LineDirectionMode.BOTH
        ? source.direction === LineDirection.OUTBOUND
          ? LineDirection.RETURN
          : LineDirection.OUTBOUND
        : LineDirection.OUTBOUND;
    const reversePairKey =
      source.directionMode === LineDirectionMode.BOTH
        ? source.pairKey ?? `pair-${source.id}`
        : undefined;

    return this.create(auth, {
      departureStationId: source.arrivalStationId,
      arrivalStationId: source.departureStationId,
      directionMode: reverseDirectionMode,
      direction: reverseDirection,
      pairKey: reversePairKey,
      isActive: source.isActive,
      intermediateStops: reversedStops
    });
  }

  private buildReversedStops(stops: ResolvedLineStop[]): ResolvedLineStop[] {
    return [...stops]
      .sort((a, b) => b.orderIndex - a.orderIndex)
      .map((stop, index) => ({
        stationId: stop.stationId,
        orderIndex: index + 1,
        // Boarding rules flip with the direction of travel: a stop that only
        // picks passengers up on the way out is where the same passengers get
        // off on the way back.
        isBoarding: stop.isDropoff,
        isDropoff: stop.isBoarding
      }));
  }

  async remove(auth: AccessTokenPayload, id: string, cascade: boolean = false): Promise<LineResponseDto> {
    await this.getLineOrThrow(auth.tenantId, id);

    if (cascade) {
      return this.prisma.$transaction(async (tx) => {
        const now = new Date();
        const rides = await tx.ride.findMany({
          where: {
            tenantId: auth.tenantId,
            lineId: id
          },
          select: {
            id: true
          }
        });

        if (rides.length > 0) {
          const rideIds = rides.map((ride) => ride.id);

          await tx.reservation.updateMany({
            where: {
              tenantId: auth.tenantId,
              rideId: {
                in: rideIds
              },
              status: ReservationStatus.ACTIVE
            },
            data: {
              status: ReservationStatus.CANCELLED,
              cancelledAt: now,
              updatedById: auth.sub
            }
          });

          await tx.ride.updateMany({
            where: {
              tenantId: auth.tenantId,
              lineId: id,
              status: {
                not: RideStatus.INACTIVE
              }
            },
            data: {
              status: RideStatus.INACTIVE,
              updatedById: auth.sub
            }
          });
        }

        const deactivated = await tx.line.update({
          where: {
            id
          },
          data: withUpdateAudit(
            {
              isActive: false
            },
            auth.sub
          ),
          select: SAFE_LINE_SELECT
        });

        return this.toLineResponse(deactivated);
      });
    }

    const activeRideReferenceCount = await this.prisma.ride.count({
      where: {
        tenantId: auth.tenantId,
        lineId: id,
        status: RideStatus.ACTIVE
      }
    });

    if (activeRideReferenceCount > 0) {
      throw new ConflictException(
        'Line cannot be deleted because it has active rides. Use cascade=true to deactivate rides and cancel reservations.'
      );
    }

    const deactivated = await this.prisma.line.update({
      where: {
        id
      },
      data: withUpdateAudit(
        {
          isActive: false
        },
        auth.sub
      ),
      select: SAFE_LINE_SELECT
    });

    return this.toLineResponse(deactivated);
  }

  private async getLineOrThrow(tenantId: string, id: string): Promise<LineWithStops & SelectedLine> {
    const line = await this.prisma.line.findFirst({
      where: {
        id,
        tenantId
      },
      select: SAFE_LINE_SELECT
    });

    if (!line) {
      throw new NotFoundException('Line not found');
    }

    return line as LineWithStops & SelectedLine;
  }

  private async ensureRouteStationsInTenant(
    tenantId: string,
    departureStationId: string,
    arrivalStationId: string
  ): Promise<{ departure: { id: string; name: string }; arrival: { id: string; name: string } }> {
    if (departureStationId === arrivalStationId) {
      throw new BadRequestException('Departure and arrival stations must be different');
    }

    const stations = await this.prisma.station.findMany({
      where: {
        tenantId,
        id: {
          in: [departureStationId, arrivalStationId]
        }
      },
      select: {
        id: true,
        name: true
      }
    });

    if (stations.length !== 2) {
      throw new BadRequestException(
        'Departure and arrival stations must both exist in the current tenant'
      );
    }

    const stationById = new Map(stations.map((station) => [station.id, station]));

    return {
      departure: stationById.get(departureStationId)!,
      arrival: stationById.get(arrivalStationId)!
    };
  }

  private async resolveIntermediateStops(
    tenantId: string,
    departureStationId: string,
    arrivalStationId: string,
    stops: LineStopInputDto[]
  ): Promise<ResolvedLineStop[]> {
    if (!stops.length) {
      return [];
    }

    const orderSet = new Set<number>();
    const stationSet = new Set<string>();

    for (const stop of stops) {
      if (orderSet.has(stop.orderIndex)) {
        throw new BadRequestException('Duplicate order index in intermediate stops is not allowed');
      }

      if (stationSet.has(stop.stationId)) {
        throw new BadRequestException('Duplicate station in intermediate stops is not allowed');
      }

      orderSet.add(stop.orderIndex);
      stationSet.add(stop.stationId);
    }

    this.ensureStopsDoNotUseRouteEndpoints(departureStationId, arrivalStationId, stops);

    const stationIds = [...stationSet];
    const stations = await this.prisma.station.findMany({
      where: {
        tenantId,
        id: {
          in: stationIds
        }
      },
      select: {
        id: true
      }
    });

    if (stations.length !== stationIds.length) {
      throw new BadRequestException('Intermediate stops must exist in the current tenant');
    }

    return [...stops]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((stop) => ({
        stationId: stop.stationId,
        orderIndex: stop.orderIndex,
        isBoarding: stop.isBoarding ?? true,
        isDropoff: stop.isDropoff ?? true
      }));
  }

  private ensureStopsDoNotUseRouteEndpoints(
    departureStationId: string,
    arrivalStationId: string,
    stops: Array<{ stationId: string }>
  ): void {
    const invalidStop = stops.find(
      (stop) => stop.stationId === departureStationId || stop.stationId === arrivalStationId
    );

    if (invalidStop) {
      throw new BadRequestException(
        'Intermediate stops cannot reuse departure or arrival station for the same line'
      );
    }
  }

  /**
   * Mirrors this line's intermediate stops onto its paired opposite direction.
   *
   * `create` already builds a reverse line with mirrored stops, so a BOTH pair
   * is meant to describe one physical route travelled two ways. `update` never
   * carried stop changes across, which let the two drift apart silently: adding
   * a stop to the outbound line left the return route without it, and no screen
   * showed that the pair disagreed.
   *
   * Only which stations are on the route is mirrored. Each direction keeps its
   * own departure and arrival, because those legitimately differ — a route can
   * come back from a different terminus than it departs to. Any mirrored stop
   * that happens to be the pair's own endpoint is dropped rather than
   * duplicated, since a stop may not reuse a route endpoint.
   *
   * Boarding rules are per direction and are never overwritten here. Which
   * stops pick passengers up and which let them off differs between the two
   * directions, and both are edited from their own row, so a stop the paired
   * line already has keeps the flags it was given there. Only a station that is
   * new to the paired line needs a starting value, and it gets the source flags
   * flipped: a stop that only picks passengers up on the way out is where the
   * same passengers get off on the way back.
   */
  private async syncPairedLineStopsTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    lineId: string,
    actorId: string,
    pairKey: string,
    nextStops: ResolvedLineStop[]
  ): Promise<void> {
    const pairedLines = await tx.line.findMany({
      where: {
        tenantId,
        pairKey,
        directionMode: LineDirectionMode.BOTH,
        id: {
          not: lineId
        }
      },
      select: {
        id: true,
        departureStationId: true,
        arrivalStationId: true,
        intermediateStops: {
          select: {
            stationId: true,
            isBoarding: true,
            isDropoff: true
          }
        }
      }
    });

    for (const pairedLine of pairedLines) {
      const existingFlagsByStationId = new Map(
        pairedLine.intermediateStops.map((stop) => [
          stop.stationId,
          { isBoarding: stop.isBoarding, isDropoff: stop.isDropoff }
        ])
      );

      const mirroredStops = this.buildReversedStops(nextStops)
        .filter(
          (stop) =>
            stop.stationId !== pairedLine.departureStationId &&
            stop.stationId !== pairedLine.arrivalStationId
        )
        // Re-number after filtering so order indexes stay contiguous.
        .map((stop, index) => {
          const existingFlags = existingFlagsByStationId.get(stop.stationId);

          return {
            stationId: stop.stationId,
            orderIndex: index + 1,
            isBoarding: existingFlags?.isBoarding ?? stop.isBoarding,
            isDropoff: existingFlags?.isDropoff ?? stop.isDropoff
          };
        });

      await this.replaceLineStopsTx(tx, tenantId, pairedLine.id, actorId, mirroredStops, true);

      // The mirrored route is a route change for the paired line too, so its
      // own ride schedules have to follow.
      await this.reconcileRideDaySchedulesToRouteTx(tx, tenantId, pairedLine.id, actorId, [
        pairedLine.departureStationId,
        ...mirroredStops.map((stop) => stop.stationId),
        pairedLine.arrivalStationId
      ]);
    }
  }

  /**
   * Realigns every ride day schedule on this line with the line's current
   * route. See `ride-schedule-alignment.ts` for why a route change invalidates
   * stored schedules and how they are repaired.
   */
  private async reconcileRideDaySchedulesToRouteTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    lineId: string,
    actorId: string,
    routeStationIds: string[]
  ): Promise<void> {
    const rides = await tx.ride.findMany({
      where: {
        lineId,
        tenantId
      },
      select: {
        daySchedules: {
          select: {
            id: true,
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
          }
        }
      }
    });

    const drifted: DayScheduleRealignInput[] = [];

    for (const ride of rides) {
      for (const daySchedule of ride.daySchedules) {
        if (isScheduleAlignedToRoute(daySchedule.stationTimes, routeStationIds)) {
          continue;
        }

        drifted.push({
          rideDayScheduleId: daySchedule.id,
          stationTimes: daySchedule.stationTimes,
          routeStationIds
        });
      }
    }

    // Rewritten in one pass: this runs inside the transaction that changed the
    // route, and a round-trip per schedule would put the line edit at the mercy
    // of how many rides happen to be on it.
    await realignDaySchedulesTx(tx, { tenantId, actorId, schedules: drifted });
  }

  private async replaceLineStopsTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    lineId: string,
    actorId: string,
    stops: ResolvedLineStop[],
    deleteExisting: boolean
  ): Promise<void> {
    if (deleteExisting) {
      await tx.lineStop.deleteMany({
        where: {
          lineId,
          tenantId
        }
      });
    }

    if (!stops.length) {
      return;
    }

    await tx.lineStop.createMany({
      data: stops.map((stop) =>
        withCreateAudit(
          {
            tenantId,
            lineId,
            stationId: stop.stationId,
            orderIndex: stop.orderIndex,
            isBoarding: stop.isBoarding,
            isDropoff: stop.isDropoff
          },
          actorId
        )
      )
    });
  }

  private validateDirectionMetadata(
    directionMode: LineDirectionMode,
    direction: LineDirection,
    pairKey: string | null
  ): void {
    if (directionMode === LineDirectionMode.SINGLE) {
      if (direction !== LineDirection.OUTBOUND) {
        throw new BadRequestException('SINGLE direction mode only supports OUTBOUND direction');
      }

      if (pairKey) {
        throw new BadRequestException('pairKey is only allowed when directionMode is BOTH');
      }

      return;
    }

    if (directionMode === LineDirectionMode.BOTH && direction === LineDirection.RETURN && !pairKey) {
      throw new BadRequestException('pairKey is required for RETURN direction when mode is BOTH');
    }
  }

  private normalizePairKey(pairKey: string | undefined): string | null {
    if (pairKey === undefined) {
      return null;
    }

    const trimmed = pairKey.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private toLineResponse(line: SelectedLine): LineResponseDto {
    return {
      ...line,
      intermediateStops: line.intermediateStops.map((stop) => ({
        stationId: stop.stationId,
        stationName: stop.station.name,
        orderIndex: stop.orderIndex,
        isBoarding: stop.isBoarding,
        isDropoff: stop.isDropoff
      }))
    };
  }

  private throwIfLineStopUniqueConstraint(error: unknown): void {
    const prismaError = error as {
      code?: string;
      meta?: {
        target?: string[];
      };
    };

    if (prismaError?.code !== 'P2002') {
      return;
    }

    const targets = prismaError.meta?.target ?? [];
    if (targets.includes('lineId_orderIndex') || targets.includes('LineStop_lineId_orderIndex_key')) {
      throw new ConflictException('Duplicate order index in intermediate stops is not allowed');
    }

    if (targets.includes('lineId_stationId') || targets.includes('LineStop_lineId_stationId_key')) {
      throw new ConflictException('Duplicate station in intermediate stops is not allowed');
    }

    throw new ConflictException('Line stop unique constraint violated');
  }
}
