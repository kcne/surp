import { Injectable, NotFoundException } from '@nestjs/common';
import { AccessTokenPayload } from '../auth/auth.types';
import { withCreateAudit, withUpdateAudit } from '../prisma/audit-write.helper';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, resolvePagination } from '../prisma/repository-helpers';
import { PrismaService } from '../prisma/prisma.service';
import { CheckPassengerDuplicatesDto, PassengerDuplicatesResponseDto } from './dto/check-passenger-duplicates.dto';
import { CreatePassengerDto } from './dto/create-passenger.dto';
import { ListPassengersQueryDto } from './dto/list-passengers.query.dto';
import {
  PaginatedPassengersResponseDto,
  PassengerResponseDto
} from './dto/passenger.response.dto';
import { UpdatePassengerDto } from './dto/update-passenger.dto';
import { normalizeNameForMatch, normalizePhoneForMatch } from './passenger-match.util';

function capitalizeName(value: string): string {
  return value
    .trim()
    .split(/(\s+|-)/)
    .map((part) => {
      if (part.length === 0 || /^\s+$/.test(part) || part === '-') {
        return part;
      }
      const lower = part.toLocaleLowerCase();
      return lower.charAt(0).toLocaleUpperCase() + lower.slice(1);
    })
    .join('');
}

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
          firstName: capitalizeName(dto.firstName),
          lastName: capitalizeName(dto.lastName),
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

  async checkDuplicates(
    auth: AccessTokenPayload,
    dto: CheckPassengerDuplicatesDto
  ): Promise<PassengerDuplicatesResponseDto> {
    const targetFullName = normalizeNameForMatch(`${dto.firstName} ${dto.lastName}`);
    const targetPhone = normalizePhoneForMatch(dto.phone);

    if (!targetFullName && !targetPhone) {
      return { matches: [] };
    }

    const candidates = await this.prisma.passenger.findMany({
      where: {
        tenantId: auth.tenantId,
        isActive: true
      },
      take: 5000,
      select: this.safePassengerSelect
    });

    const matches = candidates.filter((candidate) => {
      const candidateFullName = normalizeNameForMatch(
        `${candidate.firstName} ${candidate.lastName}`
      );
      const candidatePhone = normalizePhoneForMatch(candidate.phone ?? '');
      const nameMatches = Boolean(targetFullName) && candidateFullName === targetFullName;
      const phoneMatches = Boolean(targetPhone) && candidatePhone === targetPhone;
      return nameMatches || phoneMatches;
    });

    return { matches };
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
          ...(typeof dto.firstName === 'string' ? { firstName: capitalizeName(dto.firstName) } : {}),
          ...(typeof dto.lastName === 'string' ? { lastName: capitalizeName(dto.lastName) } : {}),
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
