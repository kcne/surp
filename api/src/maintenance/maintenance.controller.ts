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
  InvariantDetailDto,
  InvariantSummaryDto
} from '../invariants/dto/invariant-summary.response.dto';
import { InvariantRepairResultDto } from '../invariants/dto/invariant.response.dto';
import { InvariantHistoryService } from '../invariants/invariant-history.service';
import { InvariantsService, scopeOf } from '../invariants/invariants.service';
import { DomainAuditService } from '../prisma/domain-audit.service';
import { DomainAuditEventResponseDto } from './dto/domain-audit.response.dto';

/**
 * Everything behind Settings → Data integrity.
 *
 * Four checks used to have an endpoint, a DTO and a settings card each. At
 * sixteen invariants that pattern does not hold, so the whole page runs on these
 * four routes and the registry decides what is on it.
 */
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
    private readonly invariantsService: InvariantsService,
    private readonly invariantHistory: InvariantHistoryService,
    private readonly domainAudit: DomainAuditService
  ) {}

  @Get('audit/:entityType/:entityId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Recent field-level changes to one domain row, for tracing a data-integrity violation.'
  })
  @ApiParam({ name: 'entityType', example: 'LineStop' })
  @ApiParam({ name: 'entityId', example: 'clx9stop123' })
  @ApiOkResponse({ type: [DomainAuditEventResponseDto] })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  getDomainAudit(
    @Req() request: RequestWithAuth,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string
  ): Promise<DomainAuditEventResponseDto[]> {
    return this.domainAudit.history(request.auth!.tenantId, entityType, entityId);
  }

  @Get('invariants/summary')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Report every data integrity check as of the last stored run, with the date each failing check started failing. Runs nothing: opening the page must not start sixteen table scans, and the honest answer is what the last check found plus when it ran.'
  })
  @ApiOkResponse({ type: InvariantSummaryDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  getInvariantSummary(@Req() request: RequestWithAuth): Promise<InvariantSummaryDto> {
    return this.invariantHistory.summary(scopeOf(request.auth!));
  }

  @Post('invariants/check')
  @HttpCode(200)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Run every data integrity check now and store the result as a manual run, so history and the last-run time reflect it. Returns the same summary the page loads with.'
  })
  @ApiOkResponse({ type: InvariantSummaryDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  checkInvariants(@Req() request: RequestWithAuth): Promise<InvariantSummaryDto> {
    return this.invariantHistory.runNow(scopeOf(request.auth!));
  }

  @Get('invariants/:key')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'One check in full: its violations as of the last stored run, each dated to when it first appeared, plus the run-by-run counts behind it. Reads stored runs rather than checking again.'
  })
  @ApiParam({ name: 'key', example: 'reservation.reachable' })
  @ApiOkResponse({ type: InvariantDetailDto })
  @ApiBadRequestResponse({ description: 'Unknown invariant key.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  getInvariant(
    @Req() request: RequestWithAuth,
    @Param('key') key: string
  ): Promise<InvariantDetailDto> {
    return this.invariantHistory.detail(scopeOf(request.auth!), key);
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
    return this.invariantsService.repair(scopeOf(request.auth!), key);
  }
}
