import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { SkipTenantGuard } from '../auth/skip-tenant.decorator';
import { PlatformAnalyticsQueryDto } from './dto/platform-analytics.query.dto';
import { PlatformAnalyticsResponseDto } from './dto/platform-analytics.response.dto';
import { PlatformAnalyticsService } from './platform-analytics.service';

@ApiTags('Platform Analytics')
@ApiBearerAuth('access-token')
@SkipTenantGuard()
@Roles(UserRole.SUPERADMIN)
@Controller('platform/analytics')
export class PlatformAnalyticsController {
  constructor(private readonly platformAnalyticsService: PlatformAnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get aggregate platform analytics without tenant PII.' })
  @ApiOkResponse({ type: PlatformAnalyticsResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure or invalid date range.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  getOverview(@Query() query: PlatformAnalyticsQueryDto): Promise<PlatformAnalyticsResponseDto> {
    return this.platformAnalyticsService.getOverview(query);
  }
}
