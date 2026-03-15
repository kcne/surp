import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, SKIP_TENANT_GUARD_KEY } from './auth.constants';
import { RequestWithAuth } from './auth.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    const skipTenantGuard = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT_GUARD_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic || skipTenantGuard) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const tenantSlugHeader = request.headers['x-tenant-slug'];
    const tenantSlug = typeof tenantSlugHeader === 'string' ? tenantSlugHeader.trim() : '';

    if (!tenantSlug) {
      throw new BadRequestException('X-Tenant-Slug header is required');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: {
        slug: tenantSlug
      }
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (!tenant.isActive) {
      throw new ForbiddenException('Tenant is inactive');
    }

    const auth = request.auth;
    if (!auth?.tenantId) {
      throw new UnauthorizedException('Access token is invalid');
    }

    if (auth.tenantId !== tenant.id) {
      throw new ForbiddenException('Tenant mismatch between token and request context');
    }

    return true;
  }
}
