import { Module } from '@nestjs/common';
import { MarketingLeadsController } from './marketing-leads.controller';
import { MarketingLeadsService } from './marketing-leads.service';

@Module({
  controllers: [MarketingLeadsController],
  providers: [MarketingLeadsService]
})
export class MarketingLeadsModule {}
