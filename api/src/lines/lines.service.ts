import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LineDirection, LineDirectionMode } from '@prisma/client';
import { AccessTokenPayload } from '../auth/auth.types';
import { withCreateAudit, withUpdateAudit } from '../prisma/audit-write.helper';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, resolvePagination } from '../prisma/repository-helpers';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLineDto } from './dto/create-line.dto';
import { LineResponseDto, PaginatedLinesResponseDto } from './dto/line.response.dto';
import { ListLinesQueryDto } from './dto/list-lines.query.dto';
import { UpdateLineDto } from './dto/update-line.dto';

type SafeLineSelect = {
  id: true;
  tenantId: true;
  createdById: true;
  updatedById: true;
  name: true;
  departureStationId: true;
  arrivalStationId: true;
  directionMode: true;
  direction: true;
  pairKey: true;
  isActive: true;
  createdAt: true;
  updatedAt: true;
  departureStation: {
    select: {
      id: true;
      name: true;
      address: true;
      category: true;
      isActive: true;
    };
  };
  arrivalStation: {
    select: {
      id: true;
      name: true;
      address: true;
      category: true;
      isActive: true;
    };
  };
};

@Injectable()
export class LinesService {
  private readonly safeLineSelect: SafeLineSelect = {
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
    }
  };

  constructor(private readonly prisma: PrismaService) {}

  async create(auth: AccessTokenPayload, dto: CreateLineDto): Promise<LineResponseDto> {
    const stations = await this.ensureRouteStationsInTenant(
      auth.tenantId,
      dto.departureStationId,
      dto.arrivalStationId
    );

    const directionMode = dto.directionMode ?? LineDirectionMode.BOTH;
    const direction = dto.direction ?? LineDirection.OUTBOUND;
    const pairKey = this.normalizePairKey(dto.pairKey);

    this.validateDirectionMetadata(directionMode, direction, pairKey);

    return this.prisma.line.create({
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
      select: this.safeLineSelect
    });
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
        select: this.safeLineSelect
      }),
      this.prisma.line.count({ where })
    ]);

    return {
      items,
      total,
      page: pagination.page ?? DEFAULT_PAGE,
      pageSize: pagination.pageSize ?? DEFAULT_PAGE_SIZE
    };
  }

  async getById(auth: AccessTokenPayload, id: string): Promise<LineResponseDto> {
    const line = await this.prisma.line.findFirst({
      where: {
        id,
        tenantId: auth.tenantId
      },
      select: this.safeLineSelect
    });

    if (!line) {
      throw new NotFoundException('Line not found');
    }

    return line;
  }

  async update(auth: AccessTokenPayload, id: string, dto: UpdateLineDto): Promise<LineResponseDto> {
    const existing = await this.getLineOrThrow(auth.tenantId, id);

    const departureStationId = dto.departureStationId ?? existing.departureStationId;
    const arrivalStationId = dto.arrivalStationId ?? existing.arrivalStationId;

    const stations = await this.ensureRouteStationsInTenant(
      auth.tenantId,
      departureStationId,
      arrivalStationId
    );

    const directionMode = dto.directionMode ?? existing.directionMode;
    const direction = dto.direction ?? existing.direction;
    const pairKey =
      dto.pairKey !== undefined ? this.normalizePairKey(dto.pairKey) : (existing.pairKey ?? null);

    this.validateDirectionMetadata(directionMode, direction, pairKey);

    return this.prisma.line.update({
      where: {
        id
      },
      data: withUpdateAudit(
        {
          ...(typeof dto.name === 'string' ? { name: dto.name.trim() || existing.name } : {}),
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
      ),
      select: this.safeLineSelect
    });
  }

  async remove(auth: AccessTokenPayload, id: string): Promise<LineResponseDto> {
    await this.getLineOrThrow(auth.tenantId, id);

    return this.prisma.line.delete({
      where: {
        id
      },
      select: this.safeLineSelect
    });
  }

  private async getLineOrThrow(tenantId: string, id: string): Promise<{
    id: string;
    name: string;
    departureStationId: string;
    arrivalStationId: string;
    directionMode: LineDirectionMode;
    direction: LineDirection;
    pairKey: string | null;
  }> {
    const line = await this.prisma.line.findFirst({
      where: {
        id,
        tenantId
      },
      select: {
        id: true,
        name: true,
        departureStationId: true,
        arrivalStationId: true,
        directionMode: true,
        direction: true,
        pairKey: true
      }
    });

    if (!line) {
      throw new NotFoundException('Line not found');
    }

    return line;
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
}
