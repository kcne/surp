import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Tenant, User } from '@prisma/client';
import { compare } from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { LoginDto } from './dto/login.dto';
import { PrismaService } from '../prisma/prisma.service';

export type AuthLoginResult = {
  user: {
    id: string;
    tenantId: string;
    username: string;
    email: string;
    role: User['role'];
  };
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
};

@Injectable()
export class AuthService {
  private readonly accessTokenSecret: string;
  private readonly accessTokenTtlSeconds: number;
  private readonly refreshTokenTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {
    this.accessTokenSecret = this.configService.getOrThrow<string>('JWT_ACCESS_TOKEN_SECRET');
    this.accessTokenTtlSeconds = this.configService.getOrThrow<number>('JWT_ACCESS_TOKEN_TTL_SECONDS');
    this.refreshTokenTtlSeconds = this.configService.getOrThrow<number>('JWT_REFRESH_TOKEN_TTL_SECONDS');
  }

  async login(dto: LoginDto, tenantSlug: string | undefined): Promise<AuthLoginResult> {
    const tenant = await this.resolveTenantOrThrow(tenantSlug);
    const username = dto.username.trim();
    const user = await this.validateCredentialsOrThrow(tenant.id, username, dto.password);

    const accessToken = this.issueAccessToken(user, tenant.id);
    const refreshToken = await this.createRefreshSession(tenant.id, user.id);

    return {
      user: {
        id: user.id,
        tenantId: tenant.id,
        username: user.username,
        email: user.email,
        role: user.role
      },
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.accessTokenTtlSeconds
    };
  }

  private async resolveTenantOrThrow(tenantSlug: string | undefined): Promise<Tenant> {
    const normalizedTenantSlug = tenantSlug?.trim();
    if (!normalizedTenantSlug) {
      throw new BadRequestException('X-Tenant-Slug header is required');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: {
        slug: normalizedTenantSlug
      }
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (!tenant.isActive) {
      throw new ForbiddenException('Tenant is inactive');
    }

    return tenant;
  }

  private async validateCredentialsOrThrow(
    tenantId: string,
    username: string,
    password: string
  ): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: {
        tenantId_username: {
          tenantId,
          username
        }
      }
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new ForbiddenException('User is inactive');
    }

    return user;
  }

  private issueAccessToken(user: User, tenantId: string): string {
    return this.jwtService.sign(
      {
        sub: user.id,
        tenantId,
        role: user.role,
        username: user.username
      },
      {
        secret: this.accessTokenSecret,
        expiresIn: this.accessTokenTtlSeconds
      }
    );
  }

  private async createRefreshSession(tenantId: string, userId: string): Promise<string> {
    const refreshToken = randomBytes(48).toString('base64url');
    const refreshTokenHash = createHash('sha256').update(refreshToken).digest('hex');

    await this.prisma.refreshSession.create({
      data: {
        tenantId,
        userId,
        refreshTokenHash,
        expiresAt: new Date(Date.now() + this.refreshTokenTtlSeconds * 1000)
      }
    });

    return refreshToken;
  }
}
