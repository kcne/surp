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
  ApiUnauthorizedResponse
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Public } from '../auth/public.decorator';
import { RequestWithAuth } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { SkipTenantGuard } from '../auth/skip-tenant.decorator';
import { UserResponseDto } from '../users/dto/user.response.dto';
import { CreatePlatformTenantAdminDto } from './dto/create-platform-tenant-admin.dto';
import { CreatePlatformTenantDto } from './dto/create-platform-tenant.dto';
import { ListPlatformTenantsQueryDto } from './dto/list-platform-tenants.query.dto';
import {
  PaginatedPlatformTenantsResponseDto,
  PlatformTenantLoginOptionResponseDto,
  PlatformTenantResponseDto
} from './dto/platform-tenant.response.dto';
import { UpdatePlatformTenantDto } from './dto/update-platform-tenant.dto';
import { PlatformTenantsService } from './platform-tenants.service';

@ApiTags('Platform Tenants')
@SkipTenantGuard()
@Roles(UserRole.SUPERADMIN)
@Controller('platform/tenants')
export class PlatformTenantsController {
  constructor(private readonly platformTenantsService: PlatformTenantsService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new tenant in platform scope.' })
  @ApiOkResponse({ type: PlatformTenantResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure.' })
  @ApiConflictResponse({ description: 'Tenant slug already exists.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  create(
    @Req() request: RequestWithAuth,
    @Body() dto: CreatePlatformTenantDto
  ): Promise<PlatformTenantResponseDto> {
    return this.platformTenantsService.create(request.auth!, dto);
  }

  @Post(':tenantId/create-admin')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create an ADMIN user in a target tenant from platform scope.' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure.' })
  @ApiNotFoundResponse({ description: 'Tenant not found.' })
  @ApiConflictResponse({ description: 'Username or email already exists in tenant.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  createAdmin(
    @Req() request: RequestWithAuth,
    @Param('tenantId') tenantId: string,
    @Body() dto: CreatePlatformTenantAdminDto
  ): Promise<UserResponseDto> {
    return this.platformTenantsService.createAdmin(request.auth!, tenantId, dto);
  }

  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List tenants across platform scope.' })
  @ApiOkResponse({ type: PaginatedPlatformTenantsResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  list(@Query() query: ListPlatformTenantsQueryDto): Promise<PaginatedPlatformTenantsResponseDto> {
    return this.platformTenantsService.list(query);
  }

  @Get('public')
  @Public()
  @ApiOperation({ summary: 'List active tenant login options.' })
  @ApiOkResponse({ type: PlatformTenantLoginOptionResponseDto, isArray: true })
  listLoginOptions(): Promise<PlatformTenantLoginOptionResponseDto[]> {
    return this.platformTenantsService.listLoginOptions();
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a tenant by id in platform scope.' })
  @ApiOkResponse({ type: PlatformTenantResponseDto })
  @ApiNotFoundResponse({ description: 'Tenant not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  getById(@Param('id') id: string): Promise<PlatformTenantResponseDto> {
    return this.platformTenantsService.getById(id);
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update tenant slug/name in platform scope.' })
  @ApiOkResponse({ type: PlatformTenantResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure.' })
  @ApiNotFoundResponse({ description: 'Tenant not found.' })
  @ApiConflictResponse({ description: 'Tenant slug already exists.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  update(
    @Req() request: RequestWithAuth,
    @Param('id') id: string,
    @Body() dto: UpdatePlatformTenantDto
  ): Promise<PlatformTenantResponseDto> {
    return this.platformTenantsService.update(request.auth!, id, dto);
  }

  @Patch(':id/activate')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Activate a tenant.' })
  @ApiOkResponse({ type: PlatformTenantResponseDto })
  @ApiNotFoundResponse({ description: 'Tenant not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  activate(
    @Req() request: RequestWithAuth,
    @Param('id') id: string
  ): Promise<PlatformTenantResponseDto> {
    return this.platformTenantsService.activate(request.auth!, id);
  }

  @Patch(':id/deactivate')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Deactivate a tenant.' })
  @ApiOkResponse({ type: PlatformTenantResponseDto })
  @ApiNotFoundResponse({ description: 'Tenant not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role for this resource.' })
  deactivate(
    @Req() request: RequestWithAuth,
    @Param('id') id: string
  ): Promise<PlatformTenantResponseDto> {
    return this.platformTenantsService.deactivate(request.auth!, id);
  }
}
