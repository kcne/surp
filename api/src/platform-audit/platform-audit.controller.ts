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
import { ListPlatformAuditQueryDto } from './dto/list-platform-audit.query.dto';
import { PaginatedPlatformAuditResponseDto } from './dto/platform-audit.response.dto';
import { PlatformAuditService } from './platform-audit.service';

@ApiTags('Platform Audit')
@ApiBearerAuth('access-token')
@SkipTenantGuard()
@Roles(UserRole.SUPERADMIN)
@Controller('platform/audit')
export class PlatformAuditController {
  constructor(private readonly platformAuditService: PlatformAuditService) {}

  @Get()
  @ApiOperation({ summary: 'List platform-level audit events.' })
  @ApiOkResponse({ type: PaginatedPlatformAuditResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  list(@Query() query: ListPlatformAuditQueryDto): Promise<PaginatedPlatformAuditResponseDto> {
    return this.platformAuditService.list(query);
  }
}
