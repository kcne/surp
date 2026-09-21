import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuditRetentionService } from './audit-retention.service';
import { DomainAuditService } from './domain-audit.service';

@Global()
@Module({
  providers: [PrismaService, AuditRetentionService, DomainAuditService],
  exports: [PrismaService, DomainAuditService]
})
export class PrismaModule {}
