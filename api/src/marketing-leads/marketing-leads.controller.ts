import { Body, Controller, HttpCode, Ip, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { CreateMarketingLeadDto } from './dto/create-marketing-lead.dto';
import { MarketingLeadResponseDto } from './dto/marketing-lead.response.dto';
import { MarketingLeadsService } from './marketing-leads.service';

@ApiTags('Public · Marketing Leads')
@Public()
@Controller('api/public/marketing/leads')
export class MarketingLeadsController {
  constructor(private readonly marketingLeadsService: MarketingLeadsService) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Create a marketing demo lead.' })
  @ApiCreatedResponse({ type: MarketingLeadResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  createLead(
    @Body() dto: CreateMarketingLeadDto,
    @Ip() ipAddress: string | undefined
  ): Promise<MarketingLeadResponseDto> {
    return this.marketingLeadsService.createLead(dto, ipAddress);
  }
}
