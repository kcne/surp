import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InternalSandboxController } from './internal-sandbox.controller';
import { InternalSandboxService } from './internal-sandbox.service';

@Module({
  imports: [PrismaModule],
  controllers: [InternalSandboxController],
  providers: [InternalSandboxService]
})
export class InternalSandboxModule {}
