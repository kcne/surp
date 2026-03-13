import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StationsController } from './stations.controller';
import { StationsService } from './stations.service';

@Module({
  imports: [PrismaModule],
  controllers: [StationsController],
  providers: [StationsService]
})
export class StationsModule {}
