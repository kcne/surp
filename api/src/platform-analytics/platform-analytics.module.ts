import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlatformAnalyticsController } from './platform-analytics.controller';
import { PlatformAnalyticsService } from './platform-analytics.service';

@Module({
  imports: [PrismaModule],
  controllers: [PlatformAnalyticsController],
  providers: [PlatformAnalyticsService]
})
export class PlatformAnalyticsModule {}
