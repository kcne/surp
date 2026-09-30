import { Module } from '@nestjs/common';
import { DepartureNightlyService } from './departure-nightly.service';
import { DeparturesController } from './departures.controller';
import { DeparturesService } from './departures.service';

@Module({
  controllers: [DeparturesController],
  providers: [DepartureNightlyService, DeparturesService]
})
export class DeparturesModule {}
