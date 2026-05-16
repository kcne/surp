import { Injectable, Logger } from '@nestjs/common';
import { CreateMarketingLeadDto } from './dto/create-marketing-lead.dto';
import { MarketingLeadResponseDto } from './dto/marketing-lead.response.dto';

@Injectable()
export class MarketingLeadsService {
  private readonly logger = new Logger(MarketingLeadsService.name);

  createLead(dto: CreateMarketingLeadDto, ipAddress: string | undefined): MarketingLeadResponseDto {
    const id = `mlead_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    this.logger.log({
      event: 'marketing_lead_received',
      id,
      ipAddress: ipAddress ?? 'unknown',
      name: dto.name,
      email: dto.email,
      agencyName: dto.agencyName,
      phone: dto.phone ?? null,
      departuresPerDay: dto.departuresPerDay,
      hasMessage: Boolean(dto.message?.trim())
    });

    return {
      id,
      message: 'Marketing lead received.'
    };
  }
}
