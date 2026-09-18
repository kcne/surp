import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InvariantAlertEmailService } from './invariant-alert-email.service';
import { InvariantHistoryService } from './invariant-history.service';
import { InvariantRunnerService } from './invariant-runner.service';
import { InvariantsService } from './invariants.service';

@Module({
  imports: [ConfigModule],
  providers: [
    InvariantsService,
    InvariantAlertEmailService,
    InvariantHistoryService,
    InvariantRunnerService
  ],
  exports: [InvariantsService, InvariantHistoryService]
})
export class InvariantsModule {}
