import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash } from 'bcryptjs';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const prismaMock = {
    tenant: {
      findUnique: jest.fn()
    },
    user: {
      findUnique: jest.fn()
    },
    refreshSession: {
      create: jest.fn()
    }
  };

  const jwtServiceMock = {
    sign: jest.fn()
  };

  const configServiceMock = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'JWT_ACCESS_TOKEN_SECRET') {
        return 'test-secret-that-is-at-least-thirty-two-chars';
      }
      if (key === 'JWT_ACCESS_TOKEN_TTL_SECONDS') {
        return 900;
      }
      if (key === 'JWT_REFRESH_TOKEN_TTL_SECONDS') {
        return 1209600;
      }
      throw new Error(`Unexpected config key: ${key}`);
    })
  };

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      prismaMock as never,
      jwtServiceMock as unknown as JwtService,
      configServiceMock as unknown as ConfigService
    );
  });

  it('throws when tenant does not exist', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue(null);

    await expect(
      service.login({ username: 'demo-admin', password: 'demo-admin-pass' }, 'missing-tenant')
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws for invalid credentials', async () => {
    const passwordHash = await hash('different-password', 10);

    prismaMock.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', isActive: true, slug: 'demo-tenant' });
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      username: 'demo-admin',
      email: 'admin@demo.local',
      passwordHash,
      role: 'ADMIN',
      isActive: true
    });

    await expect(
      service.login({ username: 'demo-admin', password: 'wrong' }, 'demo-tenant')
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws when user is inactive', async () => {
    const passwordHash = await hash('demo-admin-pass', 10);

    prismaMock.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', isActive: true, slug: 'demo-tenant' });
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      username: 'demo-admin',
      email: 'admin@demo.local',
      passwordHash,
      role: 'ADMIN',
      isActive: false
    });

    await expect(
      service.login({ username: 'demo-admin', password: 'demo-admin-pass' }, 'demo-tenant')
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('issues tokens and persists a refresh session for valid credentials', async () => {
    const passwordHash = await hash('demo-admin-pass', 10);

    prismaMock.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', isActive: true, slug: 'demo-tenant' });
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      username: 'demo-admin',
      email: 'admin@demo.local',
      passwordHash,
      role: 'ADMIN',
      isActive: true
    });
    prismaMock.refreshSession.create.mockResolvedValue({ id: 'session-1' });
    jwtServiceMock.sign.mockReturnValue('access-token');

    const result = await service.login(
      {
        username: 'demo-admin',
        password: 'demo-admin-pass'
      },
      'demo-tenant'
    );

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBeTruthy();
    expect(result.user.username).toBe('demo-admin');
    expect(prismaMock.refreshSession.create).toHaveBeenCalledTimes(1);
    expect(jwtServiceMock.sign).toHaveBeenCalledTimes(1);
  });
});
