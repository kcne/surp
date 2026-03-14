import { Controller, Get, Query, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { RequestWithAuth } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { ReportingAuditQueryDto } from './dto/reporting-audit.query.dto';
import { ReportingDashboardQueryDto } from './dto/reporting-dashboard.query.dto';
import { ReportingOccupancyQueryDto } from './dto/reporting-occupancy.query.dto';
import {
  ReportingAuditResponseDto,
  ReportingDashboardResponseDto,
  ReportingOccupancyResponseDto
} from './dto/reporting.response.dto';
import { ReportingService } from './reporting.service';

@ApiTags('Reporting')
@ApiBearerAuth('access-token')
@ApiHeader({
  name: 'X-Tenant-Slug',
  required: true,
  description: 'Tenant slug that must match authenticated token tenant.'
})
@Controller('reporting')
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get('dashboard')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get tenant dashboard metrics and top lines for a date range.' })
  @ApiOkResponse({ type: ReportingDashboardResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure or invalid date range.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  getDashboard(
    @Req() request: RequestWithAuth,
    @Query() query: ReportingDashboardQueryDto
  ): Promise<ReportingDashboardResponseDto> {
    return this.reportingService.getDashboard(request.auth!, query);
  }

  @Get('occupancy')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({ summary: 'Get occupancy trend points by date and line for a date range.' })
  @ApiOkResponse({ type: ReportingOccupancyResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure or invalid date range.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  getOccupancy(
    @Req() request: RequestWithAuth,
    @Query() query: ReportingOccupancyQueryDto
  ): Promise<ReportingOccupancyResponseDto> {
    return this.reportingService.getOccupancy(request.auth!, query);
  }

  @Get('audit')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Query tenant audit metadata based on created/updated fields.' })
  @ApiOkResponse({ type: ReportingAuditResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure or invalid date range.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  getAudit(
    @Req() request: RequestWithAuth,
    @Query() query: ReportingAuditQueryDto
  ): Promise<ReportingAuditResponseDto> {
    return this.reportingService.getAudit(request.auth!, query);
  }
}
