import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';
import { AuthLoginResult, AuthService } from './auth.service';
import { LogoutDto } from './dto/logout.dto';
import { LogoutResponseDto } from './dto/logout.response.dto';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login.response.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with username/password in a tenant context.' })
  @ApiHeader({
    name: 'X-Tenant-Slug',
    required: true,
    description: 'Tenant slug that scopes user authentication.'
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiBadRequestResponse({ description: 'Missing or invalid request payload/header.' })
  @ApiNotFoundResponse({ description: 'Tenant slug does not exist.' })
  @ApiUnauthorizedResponse({ description: 'Credentials are invalid.' })
  @ApiForbiddenResponse({ description: 'Tenant or user is inactive.' })
  async login(
    @Headers('x-tenant-slug') tenantSlug: string | undefined,
    @Body() dto: LoginDto
  ): Promise<AuthLoginResult> {
    return this.authService.login(dto, tenantSlug);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and issue a new token pair.' })
  @ApiHeader({
    name: 'X-Tenant-Slug',
    required: true,
    description: 'Tenant slug that scopes refresh sessions.'
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiBadRequestResponse({ description: 'Missing or invalid request payload/header.' })
  @ApiNotFoundResponse({ description: 'Tenant slug does not exist.' })
  @ApiUnauthorizedResponse({ description: 'Refresh token is invalid, revoked, or expired.' })
  @ApiForbiddenResponse({ description: 'Tenant or user is inactive.' })
  async refresh(
    @Headers('x-tenant-slug') tenantSlug: string | undefined,
    @Body() dto: RefreshTokenDto
  ): Promise<AuthLoginResult> {
    return this.authService.refresh(dto.refreshToken, tenantSlug);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke the current refresh session.' })
  @ApiHeader({
    name: 'X-Tenant-Slug',
    required: true,
    description: 'Tenant slug that scopes refresh sessions.'
  })
  @ApiOkResponse({ type: LogoutResponseDto })
  @ApiBadRequestResponse({ description: 'Missing or invalid request payload/header.' })
  @ApiNotFoundResponse({ description: 'Tenant slug does not exist.' })
  @ApiUnauthorizedResponse({ description: 'Refresh token is invalid.' })
  @ApiForbiddenResponse({ description: 'Tenant is inactive.' })
  async logout(
    @Headers('x-tenant-slug') tenantSlug: string | undefined,
    @Body() dto: LogoutDto
  ): Promise<{ success: true }> {
    return this.authService.logout(dto.refreshToken, tenantSlug);
  }
}
