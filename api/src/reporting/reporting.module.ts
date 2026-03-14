import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';

@Module({
  imports: [PrismaModule],
  controllers: [ReportingController],
  providers: [ReportingService]
})
export class ReportingModule {}
