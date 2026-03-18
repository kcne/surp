import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { TicketStorageService } from './ticket-storage.service';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [TicketsController],
  providers: [TicketsService, TicketStorageService]
})
export class TicketsModule {}
