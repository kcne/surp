import { Module } from '@nestjs/common';
import { PlatformAuditModule } from '../platform-audit/platform-audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PlatformLeadsController } from './platform-leads.controller';
import { PlatformLeadsService } from './platform-leads.service';

@Module({
  imports: [PrismaModule, PlatformAuditModule],
  controllers: [PlatformLeadsController],
  providers: [PlatformLeadsService]
})
export class PlatformLeadsModule {}
