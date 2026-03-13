import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req
} from '@nestjs/common';
import {
  ApiBearerAuth,
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
import { LoginUserDto } from './dto/login.response.dto';
import { LoginResponseDto } from './dto/login.response.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestWithAuth } from './auth.types';
import { Public } from './public.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
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
  @Public()
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
  @Public()
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

  @Get('me')
  @ApiOperation({ summary: 'Get the current authenticated user profile.' })
  @ApiBearerAuth('access-token')
  @ApiHeader({
    name: 'X-Tenant-Slug',
    required: true,
    description: 'Tenant slug that must match the authenticated access token tenant.'
  })
  @ApiOkResponse({ type: LoginUserDto })
  @ApiBadRequestResponse({ description: 'X-Tenant-Slug header is required.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  @ApiForbiddenResponse({ description: 'Tenant mismatch or inactive user.' })
  me(@Req() request: RequestWithAuth): Promise<LoginUserDto> {
    return this.authService.me(request.auth);
  }
}
