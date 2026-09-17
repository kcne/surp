import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InvariantAlertEmailService } from './invariant-alert-email.service';
import { InvariantRunnerService } from './invariant-runner.service';
import { InvariantsService } from './invariants.service';

@Module({
  imports: [ConfigModule],
  providers: [InvariantsService, InvariantAlertEmailService, InvariantRunnerService],
  exports: [InvariantsService]
})
export class InvariantsModule {}
