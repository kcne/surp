import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlatformAuditController } from './platform-audit.controller';
import { PlatformAuditService } from './platform-audit.service';

@Module({
  imports: [PrismaModule],
  controllers: [PlatformAuditController],
  providers: [PlatformAuditService],
  exports: [PlatformAuditService]
})
export class PlatformAuditModule {}
