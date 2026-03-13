import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AccessTokenPayload } from '../auth/auth.types';
import { withCreateAudit, withUpdateAudit } from '../prisma/audit-write.helper';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, resolvePagination } from '../prisma/repository-helpers';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStationDto } from './dto/create-station.dto';
import { ListStationsQueryDto } from './dto/list-stations.query.dto';
import { PaginatedStationsResponseDto, StationResponseDto } from './dto/station.response.dto';
import { UpdateStationDto } from './dto/update-station.dto';

type SafeStationSelect = {
  id: true;
  tenantId: true;
  createdById: true;
  updatedById: true;
  name: true;
  address: true;
  category: true;
  contactPhone: true;
  notes: true;
  isActive: true;
  createdAt: true;
  updatedAt: true;
};

@Injectable()
export class StationsService {
  private readonly safeStationSelect: SafeStationSelect = {
    id: true,
    tenantId: true,
    createdById: true,
    updatedById: true,
    name: true,
    address: true,
    category: true,
    contactPhone: true,
    notes: true,
    isActive: true,
    createdAt: true,
    updatedAt: true
  };

  constructor(private readonly prisma: PrismaService) {}

  async create(auth: AccessTokenPayload, dto: CreateStationDto): Promise<StationResponseDto> {
    return this.prisma.station.create({
      data: withCreateAudit(
        {
          tenantId: auth.tenantId,
          name: dto.name.trim(),
          address: dto.address.trim(),
          category: dto.category,
          contactPhone: dto.contactPhone?.trim(),
          notes: dto.notes?.trim(),
          isActive: dto.isActive ?? true
        },
        auth.sub
      ),
      select: this.safeStationSelect
    });
  }

  async list(
    auth: AccessTokenPayload,
    query: ListStationsQueryDto
  ): Promise<PaginatedStationsResponseDto> {
    const pagination = resolvePagination(query.page, query.pageSize);
    const term = query.search?.trim();

    const where = {
      tenantId: auth.tenantId,
      ...(typeof query.isActive === 'boolean' ? { isActive: query.isActive } : {}),
      ...(term
        ? {
            OR: [
              { name: { contains: term, mode: 'insensitive' as const } },
              { address: { contains: term, mode: 'insensitive' as const } }
            ]
          }
        : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.station.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ createdAt: 'desc' }],
        select: this.safeStationSelect
      }),
      this.prisma.station.count({ where })
    ]);

    return {
      items,
      total,
      page: pagination.page ?? DEFAULT_PAGE,
      pageSize: pagination.pageSize ?? DEFAULT_PAGE_SIZE
    };
  }

  async getById(auth: AccessTokenPayload, id: string): Promise<StationResponseDto> {
    const station = await this.prisma.station.findFirst({
      where: {
        id,
        tenantId: auth.tenantId
      },
      select: this.safeStationSelect
    });

    if (!station) {
      throw new NotFoundException('Station not found');
    }

    return station;
  }

  async update(
    auth: AccessTokenPayload,
    id: string,
    dto: UpdateStationDto
  ): Promise<StationResponseDto> {
    await this.ensureTenantStationExists(auth.tenantId, id);

    return this.prisma.station.update({
      where: {
        id
      },
      data: withUpdateAudit(
        {
          ...(typeof dto.name === 'string' ? { name: dto.name.trim() } : {}),
          ...(typeof dto.address === 'string' ? { address: dto.address.trim() } : {}),
          ...(dto.category !== undefined ? { category: dto.category } : {}),
          ...(typeof dto.contactPhone === 'string' ? { contactPhone: dto.contactPhone.trim() } : {}),
          ...(typeof dto.notes === 'string' ? { notes: dto.notes.trim() } : {}),
          ...(typeof dto.isActive === 'boolean' ? { isActive: dto.isActive } : {})
        },
        auth.sub
      ),
      select: this.safeStationSelect
    });
  }

  async remove(auth: AccessTokenPayload, id: string): Promise<StationResponseDto> {
    await this.ensureTenantStationExists(auth.tenantId, id);

    const [lineReferenceCount, reservationReferenceCount] = await this.prisma.$transaction([
      this.prisma.line.count({
        where: {
          tenantId: auth.tenantId,
          OR: [{ departureStationId: id }, { arrivalStationId: id }]
        }
      }),
      this.prisma.reservation.count({
        where: {
          tenantId: auth.tenantId,
          OR: [{ departureStationId: id }, { arrivalStationId: id }]
        }
      })
    ]);

    if (lineReferenceCount > 0 || reservationReferenceCount > 0) {
      throw new ConflictException(
        'Station cannot be deleted because it is referenced by at least one line or reservation'
      );
    }

    return this.prisma.station.delete({
      where: {
        id
      },
      select: this.safeStationSelect
    });
  }

  private async ensureTenantStationExists(tenantId: string, id: string): Promise<void> {
    const station = await this.prisma.station.findFirst({
      where: {
        id,
        tenantId
      },
      select: {
        id: true
      }
    });

    if (!station) {
      throw new NotFoundException('Station not found');
    }
  }
}
