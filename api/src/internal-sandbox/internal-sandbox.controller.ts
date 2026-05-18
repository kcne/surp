import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  ServiceUnavailableException,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { timingSafeEqual } from 'crypto';
import { Public } from '../auth/public.decorator';
import {
  InternalSandboxResetResult,
  InternalSandboxService
} from './internal-sandbox.service';

@ApiExcludeController()
@Public()
@Controller('api/internal/sandbox')
export class InternalSandboxController {
  constructor(
    private readonly configService: ConfigService,
    private readonly internalSandboxService: InternalSandboxService
  ) {}

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 1, ttl: 60000 } })
  reset(
    @Headers('authorization') authorization: string | undefined
  ): Promise<InternalSandboxResetResult> {
    this.assertResetToken(authorization);
    return this.internalSandboxService.reset();
  }

  private assertResetToken(authorization: string | undefined): void {
    const expectedToken = this.configService.get<string>('SANDBOX_RESET_TOKEN')?.trim();
    const providedToken = this.extractBearerToken(authorization);

    if (!expectedToken) {
      throw new ServiceUnavailableException('Sandbox reset is not configured');
    }

    if (!providedToken || !this.tokensMatch(providedToken, expectedToken)) {
      throw new UnauthorizedException('Invalid sandbox reset token');
    }
  }

  private extractBearerToken(authorization: string | undefined): string | null {
    const [scheme, token] = authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      return null;
    }

    return token.trim();
  }

  private tokensMatch(providedToken: string, expectedToken: string): boolean {
    const provided = Buffer.from(providedToken);
    const expected = Buffer.from(expectedToken);

    if (provided.length !== expected.length) {
      return false;
    }

    return timingSafeEqual(provided, expected);
  }
}
