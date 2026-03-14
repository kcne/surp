import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LinesController } from './lines.controller';
import { LinesService } from './lines.service';

@Module({
  imports: [PrismaModule],
  controllers: [LinesController],
  providers: [LinesService]
})
export class LinesModule {}
