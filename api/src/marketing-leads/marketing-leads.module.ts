import { Module } from '@nestjs/common';
import { MarketingLeadsEmailService } from './marketing-leads-email.service';
import { MarketingLeadsController } from './marketing-leads.controller';
import { MarketingLeadsService } from './marketing-leads.service';

@Module({
  controllers: [MarketingLeadsController],
  providers: [MarketingLeadsEmailService, MarketingLeadsService]
})
export class MarketingLeadsModule {}
