import { Module } from '@nestjs/common';
import { DepartureNightlyService } from './departure-nightly.service';

@Module({
  providers: [DepartureNightlyService]
})
export class DeparturesModule {}
