import { Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import {
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
import {
  ScheduleDriftReportDto,
  ScheduleRealignResultDto
} from './dto/schedule-drift.response.dto';
import { MaintenanceService } from './maintenance.service';

@ApiTags('Maintenance')
@ApiBearerAuth('access-token')
@ApiHeader({
  name: 'X-Tenant-Slug',
  required: true,
  description: 'Tenant slug that must match authenticated token tenant.'
})
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get('schedule-drift')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Report ride day schedules that no longer match their line route in the current tenant.'
  })
  @ApiOkResponse({ type: ScheduleDriftReportDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  getScheduleDrift(@Req() request: RequestWithAuth): Promise<ScheduleDriftReportDto> {
    return this.maintenanceService.getScheduleDriftReport(request.auth!);
  }

  @Post('schedule-drift/realign')
  @HttpCode(200)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Rewrite drifted ride day schedules to match their line route. Existing station times are preserved by station; stations new to a route are created without a time.'
  })
  @ApiOkResponse({ type: ScheduleRealignResultDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  realignSchedules(@Req() request: RequestWithAuth): Promise<ScheduleRealignResultDto> {
    return this.maintenanceService.realignSchedules(request.auth!);
  }
}
