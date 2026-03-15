import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlatformTenantsController } from './platform-tenants.controller';
import { PlatformTenantsService } from './platform-tenants.service';

@Module({
  imports: [PrismaModule],
  controllers: [PlatformTenantsController],
  providers: [PlatformTenantsService]
})
export class PlatformTenantsModule {}
