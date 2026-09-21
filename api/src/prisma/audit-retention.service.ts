import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from './prisma.service';

export const DOMAIN_AUDIT_RETENTION_DAYS = 90;

/** Keeps operational archaeology available without turning AuditEvent into an archive. */
@Injectable()
export class AuditRetentionService {
  private readonly logger = new Logger(AuditRetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async pruneExpiredDomainEvents(): Promise<void> {
    const cutoff = new Date(Date.now() - DOMAIN_AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const deleted = await this.prisma.auditEvent.deleteMany({
      where: { entityType: { not: null }, createdAt: { lt: cutoff } }
    });

    if (deleted.count > 0) this.logger.log(`Pruned ${deleted.count} expired domain audit events`);
  }
}
