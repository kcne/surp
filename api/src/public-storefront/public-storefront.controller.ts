import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
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

  @Get(':slug/assets/ride-icon')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @ApiOperation({ summary: 'Redirect to a signed storefront ride icon image URL.' })
  @ApiNotFoundResponse({ description: 'Storefront ride icon not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  async redirectRideIcon(@Param('slug') slug: string, @Res() response: Response): Promise<void> {
    const downloadUrl = await this.publicStorefrontService.getRideIconDownloadUrl(slug);
    response.setHeader('Cache-Control', 'public, max-age=300');
    response.redirect(302, downloadUrl);
  }
}
