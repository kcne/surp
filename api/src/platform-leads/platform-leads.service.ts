import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from '@nestjs/common';
import { MarketingLeadStatus, Prisma, UserRole } from '@prisma/client';
import { hash } from 'bcryptjs';
import { AccessTokenPayload } from '../auth/auth.types';
import { PlatformAuditService } from '../platform-audit/platform-audit.service';
import { RESERVED_TENANT_SLUGS } from '../platform-tenants/reserved-slugs';
import { withCreateAudit } from '../prisma/audit-write.helper';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  buildContainsSearchWhere,
  resolvePagination
} from '../prisma/repository-helpers';
import { PrismaService } from '../prisma/prisma.service';
import { ConvertPlatformLeadDto } from './dto/convert-platform-lead.dto';
import { ListPlatformLeadsQueryDto } from './dto/list-platform-leads.query.dto';
import {
  ConvertPlatformLeadResponseDto,
  PaginatedPlatformLeadsResponseDto,
  PlatformLeadResponseDto
} from './dto/platform-lead.response.dto';
import { UpdatePlatformLeadDto } from './dto/update-platform-lead.dto';

@Injectable()
export class PlatformLeadsService {
  private readonly leadSelect = {
    id: true,
    status: true,
    name: true,
    email: true,
    agencyName: true,
    phone: true,
    departuresPerDay: true,
    message: true,
    ipAddress: true,
    notes: true,
    assigneeUserId: true,
    convertedTenantId: true,
    convertedAt: true,
    internalEmailSentAt: true,
    confirmationEmailSentAt: true,
    lastEmailError: true,
    createdAt: true,
    updatedAt: true
  } satisfies Prisma.MarketingLeadSelect;

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly platformAuditService: PlatformAuditService
  ) {}

  async list(query: ListPlatformLeadsQueryDto): Promise<PaginatedPlatformLeadsResponseDto> {
    const pagination = resolvePagination(query.page, query.pageSize);
    const where = this.buildWhere(query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.marketingLead.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ createdAt: 'desc' }],
        select: this.leadSelect
      }),
      this.prisma.marketingLead.count({ where })
    ]);

    return {
      items: items as PlatformLeadResponseDto[],
      total,
      page: pagination.page ?? DEFAULT_PAGE,
      pageSize: pagination.pageSize ?? DEFAULT_PAGE_SIZE
    };
  }

  async getById(id: string): Promise<PlatformLeadResponseDto> {
    const lead = await this.prisma.marketingLead.findUnique({
      where: { id },
      select: this.leadSelect
    });

    if (!lead) {
      throw new NotFoundException('Marketing lead not found');
    }

    return lead as PlatformLeadResponseDto;
  }

  async update(
    auth: AccessTokenPayload,
    id: string,
    dto: UpdatePlatformLeadDto
  ): Promise<PlatformLeadResponseDto> {
    await this.assertLeadExists(id);
    const data: Prisma.MarketingLeadUpdateInput = {};

    if (dto.status) {
      data.status = dto.status;
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'notes')) {
      data.notes = this.normalizeOptionalString(dto.notes ?? null);
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'assigneeUserId')) {
      data.assigneeUserId = await this.resolveAssignee(dto.assigneeUserId ?? null);
    }

    const lead = await this.prisma.$transaction(async (tx) => {
      const updatedLead = await tx.marketingLead.update({
        where: { id },
        data,
        select: this.leadSelect
      });

      await this.platformAuditService.record(
        {
          actorUserId: auth.sub,
          action: 'LEAD_UPDATED',
          targetType: 'MARKETING_LEAD',
          targetId: updatedLead.id,
          targetLeadId: updatedLead.id,
          metadata: {
            status: updatedLead.status,
            assigneeUserId: updatedLead.assigneeUserId
          }
        },
        tx
      );

      return updatedLead;
    });

    return lead as PlatformLeadResponseDto;
  }

  async convert(
    auth: AccessTokenPayload,
    id: string,
    dto: ConvertPlatformLeadDto
  ): Promise<ConvertPlatformLeadResponseDto> {
    const normalizedSlug = this.normalizeSlug(dto.tenantSlug);
    const normalizedAdminEmail = dto.adminEmail.trim().toLowerCase();
    const passwordHash = await hash(dto.adminPassword, 10);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const lead = await tx.marketingLead.findUnique({
          where: { id },
          select: this.leadSelect
        });

        if (!lead) {
          throw new NotFoundException('Marketing lead not found');
        }

        if (lead.convertedTenantId || lead.status === MarketingLeadStatus.CONVERTED) {
          throw new ConflictException('Marketing lead is already converted');
        }

        const tenant = await tx.tenant.create({
          data: {
            slug: normalizedSlug,
            name: dto.tenantName.trim(),
            timezone: this.normalizeOptionalString(dto.timezone),
            isActive: true,
            deactivatedAt: null,
            deactivatedById: null
          },
          select: this.tenantSelect
        });

        const adminUser = await tx.user.create({
          data: withCreateAudit(
            {
              tenantId: tenant.id,
              username: dto.adminUsername.trim(),
              email: normalizedAdminEmail,
              passwordHash,
              role: UserRole.ADMIN,
              isActive: true,
              requirePasswordChange: dto.requirePasswordChange ?? true
            },
            auth.sub
          ),
          select: this.safeUserSelect
        });

        const convertedLead = await tx.marketingLead.update({
          where: { id },
          data: {
            status: MarketingLeadStatus.CONVERTED,
            convertedTenantId: tenant.id,
            convertedAt: new Date()
          },
          select: this.leadSelect
        });

        await this.platformAuditService.record(
          {
            actorUserId: auth.sub,
            action: 'LEAD_CONVERTED_TO_TENANT',
            targetType: 'MARKETING_LEAD',
            targetId: convertedLead.id,
            targetTenantId: tenant.id,
            targetLeadId: convertedLead.id,
            targetUserId: adminUser.id,
            metadata: {
              tenantSlug: tenant.slug,
              tenantName: tenant.name,
              adminUserId: adminUser.id
            }
          },
          tx
        );

        return {
          lead: convertedLead as PlatformLeadResponseDto,
          tenant,
          adminUser
        };
      });
    } catch (error) {
      this.throwIfTenantSlugConflict(error);
      this.throwIfUserUniqueConstraint(error);
      throw error;
    }
  }

  private buildWhere(query: ListPlatformLeadsQueryDto): Prisma.MarketingLeadWhereInput {
    const createdAt: Prisma.DateTimeFilter = {};
    let fromDate: Date | undefined;
    let toDate: Date | undefined;
    const searchWhere = buildContainsSearchWhere(query.search, ['name', 'email', 'agencyName', 'message']);

    if (query.fromDate) {
      fromDate = this.toUtcDate(query.fromDate);
      createdAt.gte = fromDate;
    }

    if (query.toDate) {
      toDate = this.toUtcDateEnd(query.toDate);
      createdAt.lte = toDate;
    }

    if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException('fromDate cannot be after toDate');
    }

    return {
      ...(query.status ? { status: query.status } : {}),
      ...(query.assigneeUserId ? { assigneeUserId: query.assigneeUserId.trim() } : {}),
      ...(typeof query.converted === 'boolean'
        ? { convertedTenantId: query.converted ? { not: null } : null }
        : {}),
      ...(Object.keys(createdAt).length > 0 ? { createdAt } : {}),
      ...(searchWhere ?? {})
    };
  }

  private async assertLeadExists(id: string): Promise<void> {
    const lead = await this.prisma.marketingLead.findUnique({
      where: { id },
      select: { id: true }
    });

    if (!lead) {
      throw new NotFoundException('Marketing lead not found');
    }
  }

  private async resolveAssignee(assigneeUserId: string | null): Promise<string | null> {
    const normalized = this.normalizeOptionalString(assigneeUserId);
    if (!normalized) {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: normalized },
      select: {
        id: true,
        role: true,
        isActive: true
      }
    });

    if (!user || user.role !== UserRole.SUPERADMIN || !user.isActive) {
      throw new BadRequestException('assigneeUserId must reference an active superadmin user');
    }

    return user.id;
  }

  private normalizeSlug(value: string): string {
    const slug = value.trim().toLowerCase();
    if (RESERVED_TENANT_SLUGS.has(slug)) {
      throw new UnprocessableEntityException('Tenant slug is reserved');
    }

    return slug;
  }

  private normalizeOptionalString(value: string | null | undefined): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private toUtcDate(value: string): Date {
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }

  private toUtcDateEnd(value: string): Date {
    return new Date(`${value.slice(0, 10)}T23:59:59.999Z`);
  }

  private throwIfTenantSlugConflict(error: unknown): void {
    const prismaError = error as { code?: string; meta?: { target?: string[] } };

    if (prismaError?.code !== 'P2002') {
      return;
    }

    const targets = prismaError.meta?.target ?? [];
    if (targets.includes('slug')) {
      throw new ConflictException('Tenant slug already exists');
    }
  }

  private throwIfUserUniqueConstraint(error: unknown): void {
    const prismaError = error as { code?: string; meta?: { target?: string[] } };

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
  }
}
