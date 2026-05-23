import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  resolvePagination
} from '../prisma/repository-helpers';
import { PrismaService } from '../prisma/prisma.service';
import { ListPlatformAuditQueryDto } from './dto/list-platform-audit.query.dto';
import {
  PaginatedPlatformAuditResponseDto,
  PlatformAuditEventResponseDto
} from './dto/platform-audit.response.dto';

export type PlatformAuditWrite = {
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  targetTenantId?: string | null;
  targetLeadId?: string | null;
  targetUserId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
};

type PlatformAuditClient = Pick<PrismaService, 'platformAuditEvent'> | Prisma.TransactionClient;

@Injectable()
export class PlatformAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(event: PlatformAuditWrite, client: PlatformAuditClient = this.prisma): Promise<void> {
    this.assertRequired(event.actorUserId, 'actorUserId');
    this.assertRequired(event.action, 'action');
    this.assertRequired(event.targetType, 'targetType');
    this.assertRequired(event.targetId, 'targetId');

    await client.platformAuditEvent.create({
      data: {
        actorUserId: event.actorUserId,
        action: event.action,
        targetType: event.targetType,
        targetId: event.targetId,
        targetTenantId: event.targetTenantId ?? null,
        targetLeadId: event.targetLeadId ?? null,
        targetUserId: event.targetUserId ?? null,
        metadata: event.metadata ?? undefined
      }
    });
  }

  async list(query: ListPlatformAuditQueryDto): Promise<PaginatedPlatformAuditResponseDto> {
    const pagination = resolvePagination(query.page, query.pageSize);
    const where = this.buildWhere(query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.platformAuditEvent.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ createdAt: 'desc' }],
        select: {
          id: true,
          actorUserId: true,
          action: true,
          targetType: true,
          targetId: true,
          targetTenantId: true,
          targetLeadId: true,
          targetUserId: true,
          metadata: true,
          createdAt: true
        }
      }),
      this.prisma.platformAuditEvent.count({ where })
    ]);

    return {
      items: await this.enrichEvents(items),
      total,
      page: pagination.page ?? DEFAULT_PAGE,
      pageSize: pagination.pageSize ?? DEFAULT_PAGE_SIZE
    };
  }

  private async enrichEvents(
    items: Array<{
      id: string;
      actorUserId: string;
      action: string;
      targetType: string;
      targetId: string;
      targetTenantId: string | null;
      targetLeadId: string | null;
      targetUserId: string | null;
      metadata: Prisma.JsonValue | null;
      createdAt: Date;
    }>
  ): Promise<PlatformAuditEventResponseDto[]> {
    const userIds = new Set<string>();
    const tenantIds = new Set<string>();
    const leadIds = new Set<string>();

    items.forEach((item) => {
      userIds.add(item.actorUserId);
      if (item.targetUserId) {
        userIds.add(item.targetUserId);
      }
      if (item.targetType === 'USER') {
        userIds.add(item.targetId);
      }
      if (item.targetTenantId) {
        tenantIds.add(item.targetTenantId);
      }
      if (item.targetType === 'TENANT') {
        tenantIds.add(item.targetId);
      }
      if (item.targetLeadId) {
        leadIds.add(item.targetLeadId);
      }
      if (item.targetType === 'MARKETING_LEAD') {
        leadIds.add(item.targetId);
      }
    });

    const [users, tenants, leads] = await Promise.all([
      userIds.size
        ? this.prisma.user.findMany({
            where: { id: { in: Array.from(userIds) } },
            select: { id: true, username: true, email: true }
          })
        : [],
      tenantIds.size
        ? this.prisma.tenant.findMany({
            where: { id: { in: Array.from(tenantIds) } },
            select: { id: true, name: true, slug: true }
          })
        : [],
      leadIds.size
        ? this.prisma.marketingLead.findMany({
            where: { id: { in: Array.from(leadIds) } },
            select: { id: true, name: true, agencyName: true, email: true }
          })
        : []
    ]);

    const userMap = new Map(users.map((user) => [user.id, `${user.username} (${user.email})`]));
    const tenantMap = new Map(tenants.map((tenant) => [tenant.id, `${tenant.name} (${tenant.slug})`]));
    const leadMap = new Map(
      leads.map((lead) => [lead.id, `${lead.agencyName} · ${lead.name} (${lead.email})`])
    );

    return items.map((item) => {
      const targetDisplayName =
        item.targetType === 'TENANT'
          ? tenantMap.get(item.targetId) ?? null
          : item.targetType === 'USER'
            ? userMap.get(item.targetId) ?? null
            : item.targetType === 'MARKETING_LEAD'
              ? leadMap.get(item.targetId) ?? null
              : null;

      return {
        ...item,
        actorDisplayName: userMap.get(item.actorUserId) ?? null,
        targetDisplayName,
        targetTenantDisplayName: item.targetTenantId ? tenantMap.get(item.targetTenantId) ?? null : null,
        targetLeadDisplayName: item.targetLeadId ? leadMap.get(item.targetLeadId) ?? null : null,
        targetUserDisplayName: item.targetUserId ? userMap.get(item.targetUserId) ?? null : null
      };
    });
  }

  private buildWhere(query: ListPlatformAuditQueryDto): Prisma.PlatformAuditEventWhereInput {
    const createdAt: Prisma.DateTimeFilter = {};
    let fromDate: Date | undefined;
    let toDate: Date | undefined;

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
      ...(query.action ? { action: query.action.trim() } : {}),
      ...(query.targetType ? { targetType: query.targetType.trim() } : {}),
      ...(query.actorUserId ? { actorUserId: query.actorUserId.trim() } : {}),
      ...(query.targetTenantId ? { targetTenantId: query.targetTenantId.trim() } : {}),
      ...(Object.keys(createdAt).length > 0 ? { createdAt } : {})
    };
  }

  private assertRequired(value: string, fieldName: string): void {
    if (!value.trim()) {
      throw new BadRequestException(`${fieldName} is required for platform audit event`);
    }
  }

  private toUtcDate(value: string): Date {
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }

  private toUtcDateEnd(value: string): Date {
    return new Date(`${value.slice(0, 10)}T23:59:59.999Z`);
  }
}
