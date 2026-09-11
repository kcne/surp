import { Module } from '@nestjs/common';
import { InvariantsService } from '../invariants/invariants.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';

@Module({
  imports: [PrismaModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceService, InvariantsService]
})
export class MaintenanceModule {}
