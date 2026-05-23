import { Module } from '@nestjs/common';
import { PlatformAuditModule } from '../platform-audit/platform-audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PlatformTenantsController } from './platform-tenants.controller';
import { PlatformTenantsService } from './platform-tenants.service';

@Module({
  imports: [PrismaModule, PlatformAuditModule],
  controllers: [PlatformTenantsController],
  providers: [PlatformTenantsService]
})
export class PlatformTenantsModule {}
