import { Controller, Get, Header } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { PublicSeoSitemapDataResponseDto } from './dto/sitemap-data.response.dto';
import { PublicSeoService } from './public-seo.service';

@ApiTags('Public · SEO')
@Public()
@Controller('api/public/seo')
export class PublicSeoController {
  constructor(private readonly publicSeoService: PublicSeoService) {}

  @Get('sitemap-data')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Header('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
  @ApiOperation({ summary: 'Get public SEO sitemap data for published storefronts.' })
  @ApiOkResponse({ type: PublicSeoSitemapDataResponseDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  getSitemapData(): Promise<PublicSeoSitemapDataResponseDto> {
    return this.publicSeoService.getSitemapData();
  }
}
