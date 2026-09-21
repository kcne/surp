import { Injectable } from '@nestjs/common';
import { AuditEventType } from '@prisma/client';
import { PrismaService } from './prisma.service';

export type DomainAuditEvent = {
  actorUserId: string;
  action: 'create' | 'update' | 'delete';
  changes: Record<string, unknown>;
  createdAt: string;
};

/** Small, tenant-scoped read model for postmortem links. */
@Injectable()
export class DomainAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async history(tenantId: string, entityType: string, entityId: string): Promise<DomainAuditEvent[]> {
    const events = await this.prisma.auditEvent.findMany({
      where: {
        tenantId,
        entityType,
        entityId,
        type: { in: [AuditEventType.DOMAIN_CREATE, AuditEventType.DOMAIN_UPDATE, AuditEventType.DOMAIN_DELETE] }
      },
      // Retention bounds this query to 90 days. Do not silently hide the
      // creation event merely because a frequently edited row has 25 newer
      // changes; postmortems need the whole retained trail.
      orderBy: { createdAt: 'desc' },
      select: { actorUserId: true, type: true, metadata: true, createdAt: true }
    });

    return events.map((event) => {
      const metadata = asRecord(event.metadata);
      return {
        actorUserId: event.actorUserId,
        action: metadata.action === 'create' || metadata.action === 'delete' ? metadata.action : 'update',
        changes: asRecord(metadata.changes),
        createdAt: event.createdAt.toISOString()
      };
    });
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
