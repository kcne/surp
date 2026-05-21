import { Injectable, Logger } from '@nestjs/common';
import { MarketingLeadDeparturesPerDay } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMarketingLeadDto } from './dto/create-marketing-lead.dto';
import { MarketingLeadResponseDto } from './dto/marketing-lead.response.dto';
import { MarketingLeadsEmailService } from './marketing-leads-email.service';

@Injectable()
export class MarketingLeadsService {
  private readonly logger = new Logger(MarketingLeadsService.name);

  constructor(
    private readonly marketingLeadsEmailService: MarketingLeadsEmailService,
    private readonly prisma: PrismaService
  ) {}

  async createLead(dto: CreateMarketingLeadDto, ipAddress: string | undefined): Promise<MarketingLeadResponseDto> {
    const lead = await this.prisma.marketingLead.create({
      data: {
        name: dto.name,
        email: dto.email,
        agencyName: dto.agencyName,
        phone: dto.phone,
        departuresPerDay: mapDeparturesPerDay(dto.departuresPerDay),
        message: dto.message,
        ipAddress
      },
      select: {
        id: true,
        status: true
      }
    });

    this.logger.log({
      event: 'marketing_lead_received',
      id: lead.id,
      status: lead.status,
      ipAddress: ipAddress ?? 'unknown',
      agencyName: dto.agencyName,
      hasMessage: Boolean(dto.message?.trim())
    });

    const emailResult = await this.sendLeadNotification(lead.id, dto, ipAddress);
    const emailUpdateData = {
      internalEmailSentAt: emailResult.internalEmailSent ? new Date() : undefined,
      confirmationEmailSentAt: emailResult.confirmationEmailSent ? new Date() : undefined,
      lastEmailError: emailResult.errorMessage ?? null
    };

    await this.updateLeadEmailStatus(lead.id, emailUpdateData);

    return {
      id: lead.id,
      message: 'Marketing lead received.'
    };
  }

  private async updateLeadEmailStatus(
    id: string,
    data: {
      internalEmailSentAt?: Date;
      confirmationEmailSentAt?: Date;
      lastEmailError: string | null;
    }
  ): Promise<void> {
    try {
      await this.prisma.marketingLead.update({
        where: { id },
        data
      });
    } catch (error) {
      this.logger.error({
        event: 'marketing_lead_email_status_update_failed',
        id,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  private async sendLeadNotification(
    id: string,
    dto: CreateMarketingLeadDto,
    ipAddress: string | undefined
  ): Promise<{ internalEmailSent: boolean; confirmationEmailSent: boolean; errorMessage?: string }> {
    try {
      return await this.marketingLeadsEmailService.sendLeadNotification(id, dto, ipAddress);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error({
        event: 'marketing_lead_email_unexpected_failure',
        id,
        message,
        stack: error instanceof Error ? error.stack : undefined
      });
      return {
        internalEmailSent: false,
        confirmationEmailSent: false,
        errorMessage: message
      };
    }
  }
}

function mapDeparturesPerDay(value: CreateMarketingLeadDto['departuresPerDay']): MarketingLeadDeparturesPerDay {
  switch (value) {
    case '1-5':
      return MarketingLeadDeparturesPerDay.ONE_TO_FIVE;
    case '6-20':
      return MarketingLeadDeparturesPerDay.SIX_TO_TWENTY;
    case '21-50':
      return MarketingLeadDeparturesPerDay.TWENTY_ONE_TO_FIFTY;
    case '50+':
      return MarketingLeadDeparturesPerDay.FIFTY_PLUS;
    default: {
      const exhaustiveCheck: never = value;
      return exhaustiveCheck;
    }
  }
}
