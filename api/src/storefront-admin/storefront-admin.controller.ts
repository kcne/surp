import { Body, Controller, Get, HttpCode, Post, Put, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { RequestWithAuth } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { StorefrontAdminResponseDto } from '../storefront/dto/storefront.response.dto';
import {
  CompleteStorefrontAssetUploadDto,
  CreateStorefrontAssetPresignDto,
  StorefrontAssetPresignResponseDto
} from './dto/storefront-asset.dto';
import { UpsertStorefrontDto } from './dto/upsert-storefront.dto';
import { StorefrontAdminService } from './storefront-admin.service';

@ApiTags('Storefront Admin')
@ApiBearerAuth('access-token')
@ApiHeader({
  name: 'X-Tenant-Slug',
  required: true,
  description: 'Tenant slug that must match authenticated token tenant.'
})
@Controller('api/storefront')
export class StorefrontAdminController {
  constructor(private readonly storefrontAdminService: StorefrontAdminService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get storefront configuration for the current tenant.' })
  @ApiOkResponse({ type: StorefrontAdminResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role or inactive tenant.' })
  getCurrent(@Req() request: RequestWithAuth): Promise<StorefrontAdminResponseDto> {
    return this.storefrontAdminService.getCurrent(request.auth!);
  }

  @Put()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Upsert storefront configuration for the current tenant.' })
  @ApiOkResponse({ type: StorefrontAdminResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure.' })
  @ApiUnprocessableEntityResponse({ description: 'Semantic validation failure.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role or inactive tenant.' })
  upsert(
    @Req() request: RequestWithAuth,
    @Body() dto: UpsertStorefrontDto
  ): Promise<StorefrontAdminResponseDto> {
    return this.storefrontAdminService.upsert(request.auth!, dto);
  }

  @Post('publish')
  @HttpCode(200)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Publish the current tenant storefront.' })
  @ApiOkResponse({ type: StorefrontAdminResponseDto })
  @ApiNotFoundResponse({ description: 'Storefront configuration not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role or inactive tenant.' })
  publish(@Req() request: RequestWithAuth): Promise<StorefrontAdminResponseDto> {
    return this.storefrontAdminService.publish(request.auth!);
  }

  @Post('unpublish')
  @HttpCode(200)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Unpublish the current tenant storefront.' })
  @ApiOkResponse({ type: StorefrontAdminResponseDto })
  @ApiNotFoundResponse({ description: 'Storefront configuration not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role or inactive tenant.' })
  unpublish(@Req() request: RequestWithAuth): Promise<StorefrontAdminResponseDto> {
    return this.storefrontAdminService.unpublish(request.auth!);
  }

  @Post('assets/ride-icon/presign-upload')
  @HttpCode(200)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Create signed upload URL for the storefront ride icon.' })
  @ApiOkResponse({ type: StorefrontAssetPresignResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role or inactive tenant.' })
  presignRideIconUpload(
    @Req() request: RequestWithAuth,
    @Body() dto: CreateStorefrontAssetPresignDto
  ): Promise<StorefrontAssetPresignResponseDto> {
    return this.storefrontAdminService.presignRideIconUpload(
      request.auth!,
      dto.fileName,
      dto.mimeType,
      dto.sizeBytes
    );
  }

  @Post('assets/ride-icon/complete')
  @HttpCode(200)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Persist uploaded storefront ride icon metadata.' })
  @ApiOkResponse({ type: StorefrontAdminResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failure.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Insufficient role or inactive tenant.' })
  completeRideIconUpload(
    @Req() request: RequestWithAuth,
    @Body() dto: CompleteStorefrontAssetUploadDto
  ): Promise<StorefrontAdminResponseDto> {
    return this.storefrontAdminService.completeRideIconUpload(request.auth!, dto);
  }
}
