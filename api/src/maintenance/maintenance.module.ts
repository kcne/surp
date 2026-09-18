import { Module } from '@nestjs/common';
import { InvariantsModule } from '../invariants/invariants.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MaintenanceController } from './maintenance.controller';

@Module({
  imports: [PrismaModule, InvariantsModule],
  controllers: [MaintenanceController]
})
export class MaintenanceModule {}
