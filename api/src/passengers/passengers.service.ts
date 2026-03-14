import { Injectable, NotFoundException } from '@nestjs/common';
import { AccessTokenPayload } from '../auth/auth.types';
import { withCreateAudit, withUpdateAudit } from '../prisma/audit-write.helper';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, resolvePagination } from '../prisma/repository-helpers';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePassengerDto } from './dto/create-passenger.dto';
import { ListPassengersQueryDto } from './dto/list-passengers.query.dto';
import {
  PaginatedPassengersResponseDto,
  PassengerResponseDto
} from './dto/passenger.response.dto';
import { UpdatePassengerDto } from './dto/update-passenger.dto';

type SafePassengerSelect = {
  id: true;
  tenantId: true;
  createdById: true;
  updatedById: true;
  firstName: true;
  lastName: true;
  phone: true;
  email: true;
  passengerType: true;
  isActive: true;
  notes: true;
  createdAt: true;
  updatedAt: true;
};

@Injectable()
export class PassengersService {
  private readonly safePassengerSelect: SafePassengerSelect = {
    id: true,
    tenantId: true,
    createdById: true,
    updatedById: true,
    firstName: true,
    lastName: true,
    phone: true,
    email: true,
    passengerType: true,
    isActive: true,
    notes: true,
    createdAt: true,
    updatedAt: true
  };

  constructor(private readonly prisma: PrismaService) {}

  async create(auth: AccessTokenPayload, dto: CreatePassengerDto): Promise<PassengerResponseDto> {
    return this.prisma.passenger.create({
      data: withCreateAudit(
        {
          tenantId: auth.tenantId,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          phone: dto.phone.trim(),
          email: dto.email?.trim(),
          passengerType: dto.passengerType,
          isActive: dto.isActive ?? true,
          notes: dto.notes?.trim()
        },
        auth.sub
      ),
      select: this.safePassengerSelect
    });
  }

  async list(
    auth: AccessTokenPayload,
    query: ListPassengersQueryDto
  ): Promise<PaginatedPassengersResponseDto> {
    const pagination = resolvePagination(query.page, query.pageSize);
    const term = query.search?.trim();

    const where = {
      tenantId: auth.tenantId,
      ...(typeof query.isActive === 'boolean' ? { isActive: query.isActive } : {}),
      ...(term
        ? {
            OR: [
              { firstName: { contains: term, mode: 'insensitive' as const } },
              { lastName: { contains: term, mode: 'insensitive' as const } },
              { phone: { contains: term, mode: 'insensitive' as const } },
              { email: { contains: term, mode: 'insensitive' as const } }
            ]
          }
        : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.passenger.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ createdAt: 'desc' }],
        select: this.safePassengerSelect
      }),
      this.prisma.passenger.count({ where })
    ]);

    return {
      items,
      total,
      page: pagination.page ?? DEFAULT_PAGE,
      pageSize: pagination.pageSize ?? DEFAULT_PAGE_SIZE
    };
  }

  async search(
    auth: AccessTokenPayload,
    query: ListPassengersQueryDto
  ): Promise<PaginatedPassengersResponseDto> {
    return this.list(auth, query);
  }

  async getById(auth: AccessTokenPayload, id: string): Promise<PassengerResponseDto> {
    const passenger = await this.prisma.passenger.findFirst({
      where: {
        id,
        tenantId: auth.tenantId
      },
      select: this.safePassengerSelect
    });

    if (!passenger) {
      throw new NotFoundException('Passenger not found');
    }

    return passenger;
  }

  async update(
    auth: AccessTokenPayload,
    id: string,
    dto: UpdatePassengerDto
  ): Promise<PassengerResponseDto> {
    await this.ensureTenantPassengerExists(auth.tenantId, id);

    return this.prisma.passenger.update({
      where: {
        id
      },
      data: withUpdateAudit(
        {
          ...(typeof dto.firstName === 'string' ? { firstName: dto.firstName.trim() } : {}),
          ...(typeof dto.lastName === 'string' ? { lastName: dto.lastName.trim() } : {}),
          ...(typeof dto.phone === 'string' ? { phone: dto.phone.trim() } : {}),
          ...(typeof dto.email === 'string' ? { email: dto.email.trim() } : {}),
          ...(dto.passengerType !== undefined ? { passengerType: dto.passengerType } : {}),
          ...(typeof dto.isActive === 'boolean' ? { isActive: dto.isActive } : {}),
          ...(typeof dto.notes === 'string' ? { notes: dto.notes.trim() } : {})
        },
        auth.sub
      ),
      select: this.safePassengerSelect
    });
  }

  async remove(auth: AccessTokenPayload, id: string): Promise<PassengerResponseDto> {
    await this.ensureTenantPassengerExists(auth.tenantId, id);

    return this.prisma.passenger.delete({
      where: {
        id
      },
      select: this.safePassengerSelect
    });
  }

  private async ensureTenantPassengerExists(tenantId: string, id: string): Promise<void> {
    const passenger = await this.prisma.passenger.findFirst({
      where: {
        id,
        tenantId
      },
      select: {
        id: true
      }
    });

    if (!passenger) {
      throw new NotFoundException('Passenger not found');
    }
  }
}
