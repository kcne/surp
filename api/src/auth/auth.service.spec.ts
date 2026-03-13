import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash } from 'bcryptjs';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const userRecord = {
    id: 'user-1',
    tenantId: 'tenant-1',
    username: 'demo-admin',
    email: 'admin@demo.local',
    passwordHash: '',
    role: 'ADMIN',
    isActive: true
  };

  const prismaMock = {
    $transaction: jest.fn(),
    tenant: {
      findUnique: jest.fn()
    },
    user: {
      findFirst: jest.fn()
    },
    refreshSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn()
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
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) =>
      callback(prismaMock)
    );
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
    prismaMock.user.findFirst.mockResolvedValue({
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
    prismaMock.user.findFirst.mockResolvedValue({
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
    prismaMock.user.findFirst.mockResolvedValue({
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

  it('allows login by email identifier', async () => {
    const passwordHash = await hash('demo-admin-pass', 10);

    prismaMock.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', isActive: true, slug: 'demo-tenant' });
    prismaMock.user.findFirst.mockResolvedValue({
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
        username: 'admin@demo.local',
        password: 'demo-admin-pass'
      },
      'demo-tenant'
    );

    expect(result.accessToken).toBe('access-token');
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        email: 'admin@demo.local'
      }
    });
  });

  it('refreshes tokens and revokes old refresh session', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', isActive: true, slug: 'demo-tenant' });
    prismaMock.refreshSession.findUnique.mockResolvedValue({
      id: 'session-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user: userRecord
    });
    prismaMock.refreshSession.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.refreshSession.create.mockResolvedValue({ id: 'session-2' });
    jwtServiceMock.sign.mockReturnValue('new-access-token');

    const result = await service.refresh('valid-refresh-token', 'demo-tenant');

    expect(result.accessToken).toBe('new-access-token');
    expect(result.refreshToken).toBeTruthy();
    expect(prismaMock.refreshSession.updateMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.refreshSession.create).toHaveBeenCalledTimes(1);
  });

  it('fails refresh when token is reused after revocation', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', isActive: true, slug: 'demo-tenant' });
    prismaMock.refreshSession.findUnique.mockResolvedValue({
      id: 'session-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user: userRecord
    });
    prismaMock.refreshSession.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.refresh('reused-token', 'demo-tenant')).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it('fails refresh when token is already revoked', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', isActive: true, slug: 'demo-tenant' });
    prismaMock.refreshSession.findUnique.mockResolvedValue({
      id: 'session-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
      user: userRecord
    });

    await expect(service.refresh('revoked-token', 'demo-tenant')).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it('fails refresh when token is expired', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', isActive: true, slug: 'demo-tenant' });
    prismaMock.refreshSession.findUnique.mockResolvedValue({
      id: 'session-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() - 60_000),
      revokedAt: null,
      user: userRecord
    });

    await expect(service.refresh('expired-token', 'demo-tenant')).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it('revokes refresh session on logout', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', isActive: true, slug: 'demo-tenant' });
    prismaMock.refreshSession.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.logout('valid-refresh-token', 'demo-tenant');

    expect(result).toEqual({ success: true });
    expect(prismaMock.refreshSession.updateMany).toHaveBeenCalledTimes(1);
  });

  it('returns the current authenticated user profile', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      ...userRecord,
      passwordHash: 'redacted'
    });

    const result = await service.me({
      sub: 'user-1',
      tenantId: 'tenant-1',
      role: 'ADMIN',
      username: 'demo-admin'
    });

    expect(result).toEqual({
      id: 'user-1',
      tenantId: 'tenant-1',
      username: 'demo-admin',
      email: 'admin@demo.local',
      role: 'ADMIN'
    });
  });

  it('rejects me when user is inactive', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      ...userRecord,
      isActive: false,
      passwordHash: 'redacted'
    });

    await expect(
      service.me({
        sub: 'user-1',
        tenantId: 'tenant-1',
        role: 'ADMIN',
        username: 'demo-admin'
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
