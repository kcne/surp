import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [PrismaModule],
  controllers: [ReservationsController],
  providers: [ReservationsService]
})
export class ReservationsModule {}
