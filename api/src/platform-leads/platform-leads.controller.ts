import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { RequestWithAuth } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { SkipTenantGuard } from '../auth/skip-tenant.decorator';
import { ConvertPlatformLeadDto } from './dto/convert-platform-lead.dto';
import { ListPlatformLeadsQueryDto } from './dto/list-platform-leads.query.dto';
import {
  ConvertPlatformLeadResponseDto,
  PaginatedPlatformLeadsResponseDto,
  PlatformLeadResponseDto
} from './dto/platform-lead.response.dto';
import { UpdatePlatformLeadDto } from './dto/update-platform-lead.dto';
import { PlatformLeadsService } from './platform-leads.service';

@ApiTags('Platform Leads')
@ApiBearerAuth('access-token')
@SkipTenantGuard()
@Roles(UserRole.SUPERADMIN)
@Controller('platform/leads')
export class PlatformLeadsController {
  constructor(private readonly platformLeadsService: PlatformLeadsService) {}

  @Get()
  @ApiOperation({ summary: 'List marketing leads in platform scope.' })
  @ApiOkResponse({ type: PaginatedPlatformLeadsResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  list(@Query() query: ListPlatformLeadsQueryDto): Promise<PaginatedPlatformLeadsResponseDto> {
    return this.platformLeadsService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a marketing lead by id in platform scope.' })
  @ApiOkResponse({ type: PlatformLeadResponseDto })
  @ApiNotFoundResponse({ description: 'Marketing lead not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  getById(@Param('id') id: string): Promise<PlatformLeadResponseDto> {
    return this.platformLeadsService.getById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update marketing lead status, notes, or assignment.' })
  @ApiOkResponse({ type: PlatformLeadResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure.' })
  @ApiNotFoundResponse({ description: 'Marketing lead not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  update(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: UpdatePlatformLeadDto
  ): Promise<PlatformLeadResponseDto> {
    return this.platformLeadsService.update(request.auth!, id, dto);
  }

  @Post(':id/convert-to-agency')
  @ApiOperation({ summary: 'Convert a marketing lead into a tenant with an admin user.' })
  @ApiOkResponse({ type: ConvertPlatformLeadResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure.' })
  @ApiNotFoundResponse({ description: 'Marketing lead not found.' })
  @ApiConflictResponse({ description: 'Lead already converted or target tenant/user already exists.' })
  @ApiUnprocessableEntityResponse({ description: 'Tenant slug is reserved.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  convert(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: ConvertPlatformLeadDto
  ): Promise<ConvertPlatformLeadResponseDto> {
    return this.platformLeadsService.convert(request.auth!, id, dto);
  }
}
