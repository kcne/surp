import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RidesController } from './rides.controller';
import { RidesService } from './rides.service';

@Module({
  imports: [PrismaModule],
  controllers: [RidesController],
  providers: [RidesService]
})
export class RidesModule {}
