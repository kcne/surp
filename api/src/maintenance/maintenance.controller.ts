import { Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiBadRequestResponse,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { RequestWithAuth } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import {
  InvariantRepairResultDto,
  InvariantReportDto,
  InvariantResultDto
} from '../invariants/dto/invariant.response.dto';
import { InvariantsService } from '../invariants/invariants.service';
import {
  OrphanedReservationReportDto,
  OrphanedReservationRepairResultDto
} from './dto/orphaned-reservation.response.dto';
import { PairDriftReportDto, PairSyncResultDto } from './dto/pair-drift.response.dto';
import { ReturnRouteGapReportDto } from './dto/return-route-gap.response.dto';
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
  constructor(
    private readonly maintenanceService: MaintenanceService,
    private readonly invariantsService: InvariantsService
  ) {}

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

  @Get('pair-drift')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Report paired lines whose two directions no longer carry the same intermediate stops.'
  })
  @ApiOkResponse({ type: PairDriftReportDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  getPairDrift(@Req() request: RequestWithAuth): Promise<PairDriftReportDto> {
    return this.maintenanceService.getPairDriftReport(request.auth!);
  }

  @Post('pair-drift/sync')
  @HttpCode(200)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Give both directions of a paired line the same intermediate stops, keeping each direction own endpoints. Pairs whose directions genuinely disagree are skipped.'
  })
  @ApiOkResponse({ type: PairSyncResultDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  syncPairs(@Req() request: RequestWithAuth): Promise<PairSyncResultDto> {
    return this.maintenanceService.syncPairs(request.auth!);
  }

  @Get('return-route-gaps')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Report paired lines where one direction ends at a station the other never calls at, which blocks return tickets through that station. Reported only; placing a terminus onto the opposite route is a routing decision.'
  })
  @ApiOkResponse({ type: ReturnRouteGapReportDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  getReturnRouteGaps(@Req() request: RequestWithAuth): Promise<ReturnRouteGapReportDto> {
    return this.maintenanceService.getReturnRouteGapReport(request.auth!);
  }

  @Get('orphaned-reservations')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Report active reservations in the next 30 days that no ride instance can reach, usually because a route edit moved the instance departure time away from the one stored on the reservation.'
  })
  @ApiOkResponse({ type: OrphanedReservationReportDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  getOrphanedReservations(
    @Req() request: RequestWithAuth
  ): Promise<OrphanedReservationReportDto> {
    return this.maintenanceService.getOrphanedReservationReport(request.auth!);
  }

  @Post('orphaned-reservations/repair')
  @HttpCode(200)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Move unreachable reservations onto the single ride instance that runs on their travel date. Each keeps its seat where that seat is still free, otherwise it takes the lowest free one. Dates with no instance, or with more than one, are left untouched.'
  })
  @ApiOkResponse({ type: OrphanedReservationRepairResultDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  repairOrphanedReservations(
    @Req() request: RequestWithAuth
  ): Promise<OrphanedReservationRepairResultDto> {
    return this.maintenanceService.repairOrphanedReservations(request.auth!);
  }

  @Get('invariants')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Run every data integrity check for the current tenant and report them in one shape. Each result carries what was scanned alongside what was wrong, so a clean check is distinguishable from one that examined nothing.'
  })
  @ApiOkResponse({ type: InvariantReportDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  checkInvariants(@Req() request: RequestWithAuth): Promise<InvariantReportDto> {
    return this.invariantsService.checkAll(request.auth!);
  }

  @Get('invariants/:key')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Run a single data integrity check for the current tenant.' })
  @ApiParam({ name: 'key', example: 'reservation.reachable' })
  @ApiOkResponse({ type: InvariantResultDto })
  @ApiBadRequestResponse({ description: 'Unknown invariant key.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  checkInvariant(
    @Req() request: RequestWithAuth,
    @Param('key') key: string
  ): Promise<InvariantResultDto> {
    return this.invariantsService.checkOne(request.auth!, key);
  }

  @Post('invariants/:key/repair')
  @HttpCode(200)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Repair one invariant, then re-run its check so the response says what is left rather than what was attempted. Checks whose fix would require a decision the data cannot make have no repair and are rejected.'
  })
  @ApiParam({ name: 'key', example: 'reservation.reachable' })
  @ApiOkResponse({ type: InvariantRepairResultDto })
  @ApiBadRequestResponse({ description: 'Unknown invariant key, or the invariant is report-only.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  repairInvariant(
    @Req() request: RequestWithAuth,
    @Param('key') key: string
  ): Promise<InvariantRepairResultDto> {
    return this.invariantsService.repair(request.auth!, key);
  }
}
