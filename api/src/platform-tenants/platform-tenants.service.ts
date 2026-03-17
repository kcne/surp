import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { hash } from 'bcryptjs';
import { AccessTokenPayload } from '../auth/auth.types';
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

  constructor(private readonly prisma: PrismaService) {}

  async create(
    auth: AccessTokenPayload,
    dto: CreatePlatformTenantDto
  ): Promise<PlatformTenantResponseDto> {
    try {
      return await this.prisma.tenant.create({
        data: {
          slug: this.normalizeSlug(dto.slug),
          name: dto.name.trim(),
          isActive: true,
          deactivatedAt: null,
          deactivatedById: null
        },
        select: this.tenantSelect
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
      return await this.prisma.user.create({
        data: withCreateAudit(
          {
            tenantId,
            username: normalizedUsername,
            email: normalizedEmail,
            passwordHash: await hash(dto.password, 10),
            role: UserRole.ADMIN,
            isActive: true,
            requirePasswordChange: dto.requirePasswordChange ?? false
          },
          auth.sub
        ),
        select: this.safeUserSelect
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

    return {
      items,
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

    return tenant;
  }

  async update(
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

    try {
      return await this.prisma.tenant.update({
        where: { id },
        data,
        select: this.tenantSelect
      });
    } catch (error) {
      this.throwIfSlugConflict(error);
      throw error;
    }
  }

  async activate(id: string): Promise<PlatformTenantResponseDto> {
    await this.assertTenantExists(id);

    return this.prisma.tenant.update({
      where: { id },
      data: {
        isActive: true,
        deactivatedAt: null,
        deactivatedById: null
      },
      select: this.tenantSelect
    });
  }

  async deactivate(auth: AccessTokenPayload, id: string): Promise<PlatformTenantResponseDto> {
    await this.assertTenantExists(id);

    return this.prisma.tenant.update({
      where: { id },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedById: auth.sub
      },
      select: this.tenantSelect
    });
  }

  private normalizeSlug(value: string): string {
    return value.trim().toLowerCase();
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
