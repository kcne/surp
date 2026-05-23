import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from '@nestjs/common';
import { Prisma, RideStatus, TicketStatus, UserRole } from '@prisma/client';
import { hash } from 'bcryptjs';
import { AccessTokenPayload } from '../auth/auth.types';
import { PlatformAuditService } from '../platform-audit/platform-audit.service';
import { withCreateAudit } from '../prisma/audit-write.helper';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  buildContainsSearchWhere,
  resolvePagination
} from '../prisma/repository-helpers';
import { PrismaService } from '../prisma/prisma.service';
import { UserResponseDto } from '../users/dto/user.response.dto';
import { CreatePlatformTenantAdminDto } from './dto/create-platform-tenant-admin.dto';
import { CreatePlatformTenantDto } from './dto/create-platform-tenant.dto';
import { ListPlatformTenantsQueryDto } from './dto/list-platform-tenants.query.dto';
import {
  PaginatedPlatformTenantsResponseDto,
  PlatformTenantLoginOptionResponseDto,
  PlatformTenantResponseDto
} from './dto/platform-tenant.response.dto';
import { RESERVED_TENANT_SLUGS } from './reserved-slugs';
import { UpdatePlatformTenantDto } from './dto/update-platform-tenant.dto';

@Injectable()
export class PlatformTenantsService {
  private readonly safeUserSelect = {
    id: true,
    tenantId: true,
    createdById: true,
    updatedById: true,
    username: true,
    email: true,
    role: true,
    requirePasswordChange: true,
    isActive: true,
    createdAt: true,
    updatedAt: true
  } satisfies Prisma.UserSelect;

  private readonly tenantSelect = {
    id: true,
    slug: true,
    name: true,
    timezone: true,
    isActive: true,
    deactivatedAt: true,
    deactivatedById: true,
    createdAt: true,
    updatedAt: true
  } satisfies Prisma.TenantSelect;

  private readonly tenantLoginOptionSelect = {
    slug: true,
    name: true
  } satisfies Prisma.TenantSelect;

  constructor(
    private readonly prisma: PrismaService,
    private readonly platformAuditService: PlatformAuditService
  ) {}

  async create(
    auth: AccessTokenPayload,
    dto: CreatePlatformTenantDto
  ): Promise<PlatformTenantResponseDto> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            slug: this.normalizeSlug(dto.slug),
            name: dto.name.trim(),
            timezone: this.normalizeOptionalString(dto.timezone),
            isActive: true,
            deactivatedAt: null,
            deactivatedById: null
          },
          select: this.tenantSelect
        });

        await this.platformAuditService.record(
          {
            actorUserId: auth.sub,
            action: 'TENANT_CREATED',
            targetType: 'TENANT',
            targetId: tenant.id,
            targetTenantId: tenant.id,
            metadata: {
              slug: tenant.slug,
              name: tenant.name
            }
          },
          tx
        );

        return tenant;
      });
    } catch (error) {
      this.throwIfSlugConflict(error);
      throw error;
    }
  }

  async createAdmin(
    auth: AccessTokenPayload,
    tenantId: string,
    dto: CreatePlatformTenantAdminDto
  ): Promise<UserResponseDto> {
    await this.assertTenantExists(tenantId);

    const normalizedUsername = dto.username.trim();
    const normalizedEmail = dto.email.trim().toLowerCase();

    try {
      const passwordHash = await hash(dto.password, 10);

      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: withCreateAudit(
            {
              tenantId,
              username: normalizedUsername,
              email: normalizedEmail,
              passwordHash,
              role: UserRole.ADMIN,
              isActive: true,
              requirePasswordChange: dto.requirePasswordChange ?? false
            },
            auth.sub
          ),
          select: this.safeUserSelect
        });

        await this.platformAuditService.record(
          {
            actorUserId: auth.sub,
            action: 'TENANT_ADMIN_CREATED',
            targetType: 'USER',
            targetId: user.id,
            targetTenantId: tenantId,
            targetUserId: user.id,
            metadata: {
              username: user.username,
              email: user.email
            }
          },
          tx
        );

        return user;
      });
    } catch (error) {
      this.throwIfUserUniqueConstraint(error);
      throw error;
    }
  }

  async list(query: ListPlatformTenantsQueryDto): Promise<PaginatedPlatformTenantsResponseDto> {
    const pagination = resolvePagination(query.page, query.pageSize);
    const searchWhere = buildContainsSearchWhere(query.search, ['slug', 'name']);

    const where: Prisma.TenantWhereInput = {
      ...(typeof query.isActive === 'boolean' ? { isActive: query.isActive } : {}),
      ...(searchWhere ?? {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.tenant.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ createdAt: 'desc' }],
        select: this.tenantSelect
      }),
      this.prisma.tenant.count({ where })
    ]);

    const itemsWithKpis = await this.attachKpis(items, query);

    return {
      items: itemsWithKpis,
      total,
      page: pagination.page ?? DEFAULT_PAGE,
      pageSize: pagination.pageSize ?? DEFAULT_PAGE_SIZE
    };
  }

  async listLoginOptions(): Promise<PlatformTenantLoginOptionResponseDto[]> {
    return this.prisma.tenant.findMany({
      where: { isActive: true },
      orderBy: [{ name: 'asc' }],
      select: this.tenantLoginOptionSelect
    });
  }

  async getById(id: string): Promise<PlatformTenantResponseDto> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: this.tenantSelect
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return this.attachKpi(tenant, {});
  }

  async update(
    auth: AccessTokenPayload,
    id: string,
    dto: UpdatePlatformTenantDto
  ): Promise<PlatformTenantResponseDto> {
    await this.assertTenantExists(id);

    const data: Prisma.TenantUpdateInput = {};
    if (typeof dto.slug === 'string') {
      data.slug = this.normalizeSlug(dto.slug);
    }

    if (typeof dto.name === 'string') {
      data.name = dto.name.trim();
    }

    if (typeof dto.timezone === 'string') {
      data.timezone = this.normalizeOptionalString(dto.timezone);
    }

    try {
      const tenant = await this.prisma.$transaction(async (tx) => {
        const updatedTenant = await tx.tenant.update({
          where: { id },
          data,
          select: this.tenantSelect
        });

        await this.platformAuditService.record(
          {
            actorUserId: auth.sub,
            action: 'TENANT_UPDATED',
            targetType: 'TENANT',
            targetId: updatedTenant.id,
            targetTenantId: updatedTenant.id,
            metadata: data as Prisma.InputJsonValue
          },
          tx
        );

        return updatedTenant;
      });

      return this.attachKpi(tenant, {});
    } catch (error) {
      this.throwIfSlugConflict(error);
      throw error;
    }
  }

  async activate(auth: AccessTokenPayload, id: string): Promise<PlatformTenantResponseDto> {
    await this.assertTenantExists(id);

    const tenant = await this.prisma.$transaction(async (tx) => {
      const activatedTenant = await tx.tenant.update({
        where: { id },
        data: {
          isActive: true,
          deactivatedAt: null,
          deactivatedById: null
        },
        select: this.tenantSelect
      });

      await this.platformAuditService.record(
        {
          actorUserId: auth.sub,
          action: 'TENANT_ACTIVATED',
          targetType: 'TENANT',
          targetId: activatedTenant.id,
          targetTenantId: activatedTenant.id
        },
        tx
      );

      return activatedTenant;
    });

    return this.attachKpi(tenant, {});
  }

  async deactivate(auth: AccessTokenPayload, id: string): Promise<PlatformTenantResponseDto> {
    await this.assertTenantExists(id);

    const tenant = await this.prisma.$transaction(async (tx) => {
      const deactivatedTenant = await tx.tenant.update({
        where: { id },
        data: {
          isActive: false,
          deactivatedAt: new Date(),
          deactivatedById: auth.sub
        },
        select: this.tenantSelect
      });

      await this.platformAuditService.record(
        {
          actorUserId: auth.sub,
          action: 'TENANT_DEACTIVATED',
          targetType: 'TENANT',
          targetId: deactivatedTenant.id,
          targetTenantId: deactivatedTenant.id
        },
        tx
      );

      return deactivatedTenant;
    });

    return this.attachKpi(tenant, {});
  }

  private async attachKpis<T extends PlatformTenantResponseDto>(
    tenants: T[],
    query: Pick<ListPlatformTenantsQueryDto, 'fromDate' | 'toDate'>
  ): Promise<PlatformTenantResponseDto[]> {
    return Promise.all(tenants.map((tenant) => this.attachKpi(tenant, query)));
  }

  private async attachKpi<T extends PlatformTenantResponseDto>(
    tenant: T,
    query: Pick<ListPlatformTenantsQueryDto, 'fromDate' | 'toDate'>
  ): Promise<PlatformTenantResponseDto> {
    const range = this.resolveDateRange(query.fromDate, query.toDate);
    const tenantId = tenant.id;

    const [
      totalUsers,
      activeUsers,
      reservationsInPeriod,
      activeRides,
      activeLines,
      totalPassengers,
      activePassengers,
      openTickets,
      inProgressTickets,
      storefront,
      lastActivityAt
    ] = await Promise.all([
      this.prisma.user.count({ where: { tenantId } }),
      this.prisma.user.count({ where: { tenantId, isActive: true } }),
      this.prisma.reservation.count({
        where: {
          tenantId,
          travelDate: {
            gte: range.fromDate,
            lte: range.toDate
          }
        }
      }),
      this.prisma.ride.count({ where: { tenantId, status: RideStatus.ACTIVE } }),
      this.prisma.line.count({ where: { tenantId, isActive: true } }),
      this.prisma.passenger.count({ where: { tenantId } }),
      this.prisma.passenger.count({ where: { tenantId, isActive: true } }),
      this.prisma.ticket.count({ where: { tenantId, status: TicketStatus.OPEN } }),
      this.prisma.ticket.count({ where: { tenantId, status: TicketStatus.IN_PROGRESS } }),
      this.prisma.agencyStorefront.findUnique({
        where: { tenantId },
        select: {
          status: true,
          publishedAt: true
        }
      }),
      this.getLastActivityAt(tenantId)
    ]);

    return {
      ...tenant,
      kpis: {
        totalUsers,
        activeUsers,
        reservationsInPeriod,
        activeRides,
        activeLines,
        totalPassengers,
        activePassengers,
        openTickets,
        inProgressTickets,
        storefront: {
          status: storefront?.status ?? null,
          publishedAt: storefront?.publishedAt ?? null
        },
        lastActivityAt
      }
    };
  }

  private async getLastActivityAt(tenantId: string): Promise<Date | null> {
    const rows = await Promise.all([
      this.getLatestUpdatedAt('user', tenantId),
      this.getLatestUpdatedAt('station', tenantId),
      this.getLatestUpdatedAt('line', tenantId),
      this.getLatestUpdatedAt('passenger', tenantId),
      this.getLatestUpdatedAt('ride', tenantId),
      this.getLatestUpdatedAt('reservation', tenantId),
      this.getLatestUpdatedAt('ticket', tenantId)
    ]);

    const timestamps = rows.filter((value): value is Date => value instanceof Date);
    if (timestamps.length === 0) {
      return null;
    }

    return timestamps.reduce((latest, current) => (current.getTime() > latest.getTime() ? current : latest));
  }

  private async getLatestUpdatedAt(
    model: 'user' | 'station' | 'line' | 'passenger' | 'ride' | 'reservation' | 'ticket',
    tenantId: string
  ): Promise<Date | null> {
    const query = {
      where: { tenantId },
      orderBy: { updatedAt: 'desc' as const },
      select: { updatedAt: true }
    };

    switch (model) {
      case 'user':
        return (await this.prisma.user.findFirst(query))?.updatedAt ?? null;
      case 'station':
        return (await this.prisma.station.findFirst(query))?.updatedAt ?? null;
      case 'line':
        return (await this.prisma.line.findFirst(query))?.updatedAt ?? null;
      case 'passenger':
        return (await this.prisma.passenger.findFirst(query))?.updatedAt ?? null;
      case 'ride':
        return (await this.prisma.ride.findFirst(query))?.updatedAt ?? null;
      case 'reservation':
        return (await this.prisma.reservation.findFirst(query))?.updatedAt ?? null;
      case 'ticket':
        return (await this.prisma.ticket.findFirst(query))?.updatedAt ?? null;
      default: {
        const exhaustiveCheck: never = model;
        return exhaustiveCheck;
      }
    }
  }

  private resolveDateRange(fromDate?: string, toDate?: string): { fromDate: Date; toDate: Date } {
    const now = new Date();
    const end = toDate ? this.toUtcDate(toDate) : this.toUtcDate(now.toISOString().slice(0, 10));
    const startDefault = new Date(end);
    startDefault.setUTCDate(startDefault.getUTCDate() - 29);
    const start = fromDate ? this.toUtcDate(fromDate) : startDefault;

    if (start.getTime() > end.getTime()) {
      throw new BadRequestException('fromDate cannot be after toDate');
    }

    return { fromDate: start, toDate: end };
  }

  private toUtcDate(value: string): Date {
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }

  private normalizeSlug(value: string): string {
    const slug = value.trim().toLowerCase();
    if (RESERVED_TENANT_SLUGS.has(slug)) {
      throw new UnprocessableEntityException('Tenant slug is reserved');
    }

    return slug;
  }

  private normalizeOptionalString(value: string | undefined): string | null | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private async assertTenantExists(id: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: { id: true }
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
  }

  private throwIfSlugConflict(error: unknown): void {
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
    if (targets.includes('slug')) {
      throw new ConflictException('Tenant slug already exists');
    }
  }

  private throwIfUserUniqueConstraint(error: unknown): void {
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
    if (targets.includes('username') || targets.includes('tenantId') || targets.includes('tenantId_username')) {
      throw new ConflictException('Username already exists in this tenant');
    }

    if (targets.includes('email') || targets.includes('tenantId_email')) {
      throw new ConflictException('Email already exists in this tenant');
    }

    throw new ConflictException('User unique constraint violated in this tenant');
  }
}
