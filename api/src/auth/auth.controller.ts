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
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login.response.dto';

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
}
