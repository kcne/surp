import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { PublicAgencyStorefrontResponseDto } from '../storefront/dto/storefront.response.dto';
import { PublicStorefrontService } from './public-storefront.service';

@ApiTags('Public · Agencies')
@Public()
@Controller('api/public/agencies')
export class PublicStorefrontController {
  constructor(private readonly publicStorefrontService: PublicStorefrontService) {}

  @Get(':slug')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Get a published public agency storefront by slug.' })
  @ApiOkResponse({ type: PublicAgencyStorefrontResponseDto })
  @ApiNotFoundResponse({ description: 'Published active agency storefront not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  getAgencyBySlug(@Param('slug') slug: string): Promise<PublicAgencyStorefrontResponseDto> {
    return this.publicStorefrontService.getAgencyBySlug(slug);
  }
}
