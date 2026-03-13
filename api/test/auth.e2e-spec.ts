import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { hash } from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let activeUserPasswordHash: string;
  let inactiveUserPasswordHash: string;
  let refreshReplayConsumed = false;

  const prismaMock = {
    $transaction: jest.fn(),
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    enableShutdownHooks: jest.fn(),
    isHealthy: jest.fn(),
    tenant: {
      findUnique: jest.fn()
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn()
    },
    refreshSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn()
    }
  };

  const jwtServiceMock = {
    sign: jest.fn(() => 'access-token'),
    verify: jest.fn()
  };

  beforeAll(async () => {
    activeUserPasswordHash = await hash('demo-admin-pass', 10);
    inactiveUserPasswordHash = await hash('demo-inactive-pass', 10);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    refreshReplayConsumed = false;

    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) =>
      callback(prismaMock)
    );

    prismaMock.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      slug: 'demo-tenant',
      isActive: true
    });

    jwtServiceMock.verify.mockImplementation((token: string) => {
      if (token === 'access-token-admin') {
        return {
          sub: 'user-1',
          tenantId: 'tenant-1',
          role: 'ADMIN',
          username: 'demo-admin'
        };
      }

      if (token === 'access-token-manager') {
        return {
          sub: 'user-2',
          tenantId: 'tenant-1',
          role: 'MANAGER',
          username: 'demo-manager'
        };
      }

      if (token === 'access-token-staff') {
        return {
          sub: 'user-3',
          tenantId: 'tenant-1',
          role: 'STAFF',
          username: 'demo-staff'
        };
      }

      if (token === 'access-token-other-tenant') {
        return {
          sub: 'user-4',
          tenantId: 'tenant-2',
          role: 'ADMIN',
          username: 'foreign-admin'
        };
      }

      throw new Error('invalid token');
    });

    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      username: 'demo-admin',
      email: 'admin@demo.local',
      passwordHash: activeUserPasswordHash,
      role: 'ADMIN',
      isActive: true
    });

    prismaMock.user.findFirst.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      username: 'demo-admin',
      email: 'admin@demo.local',
      passwordHash: activeUserPasswordHash,
      role: 'ADMIN',
      isActive: true
    });

    prismaMock.refreshSession.create.mockResolvedValue({ id: 'session-1' });
    prismaMock.refreshSession.findUnique.mockResolvedValue({
      id: 'session-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user: {
        id: 'user-1',
        tenantId: 'tenant-1',
        username: 'demo-admin',
        email: 'admin@demo.local',
        passwordHash: activeUserPasswordHash,
        role: 'ADMIN',
        isActive: true
      }
    });
    prismaMock.refreshSession.updateMany.mockResolvedValue({ count: 1 });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(JwtService)
      .useValue(jwtServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('issues access and refresh tokens for valid credentials', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Slug', 'demo-tenant')
      .send({ username: 'demo-admin', password: 'demo-admin-pass' })
      .expect(200);

    expect(response.body.accessToken).toBe('access-token');
    expect(response.body.refreshToken).toBeTruthy();
    expect(response.body.user.username).toBe('demo-admin');
    expect(prismaMock.refreshSession.create).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid password', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Slug', 'demo-tenant')
      .send({ username: 'demo-admin', password: 'wrong-password' })
      .expect(401);
  });

  it('rejects inactive user login', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-2',
      tenantId: 'tenant-1',
      username: 'demo-inactive',
      email: 'inactive@demo.local',
      passwordHash: inactiveUserPasswordHash,
      role: 'STAFF',
      isActive: false
    });

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Slug', 'demo-tenant')
      .send({ username: 'demo-inactive', password: 'demo-inactive-pass' })
      .expect(403);

    expect(response.body.message).toBe('User is inactive');
  });

  it('rejects tenant mismatch', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Slug', 'demo-tenant')
      .send({ username: 'other-tenant-user', password: 'demo-admin-pass' })
      .expect(401);
  });

  it('returns validation error when tenant header is missing', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'demo-admin', password: 'demo-admin-pass' })
      .expect(400);

    expect(response.body.message).toBe('X-Tenant-Slug header is required');
  });

  it('refreshes tokens and rotates refresh session', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('X-Tenant-Slug', 'demo-tenant')
      .send({ refreshToken: 'refresh-token-1' })
      .expect(200);

    expect(response.body.accessToken).toBe('access-token');
    expect(response.body.refreshToken).toBeTruthy();
    expect(prismaMock.refreshSession.updateMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.refreshSession.create).toHaveBeenCalledTimes(1);
  });

  it('rejects replay when old refresh token is reused', async () => {
    prismaMock.refreshSession.updateMany.mockImplementation(async () => {
      if (refreshReplayConsumed) {
        return { count: 0 };
      }

      refreshReplayConsumed = true;
      return { count: 1 };
    });

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('X-Tenant-Slug', 'demo-tenant')
      .send({ refreshToken: 'refresh-token-1' })
      .expect(200);

    const replayResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('X-Tenant-Slug', 'demo-tenant')
      .send({ refreshToken: 'refresh-token-1' })
      .expect(401);

    expect(replayResponse.body.message).toBe('Refresh token is invalid');
  });

  it('rejects revoked refresh token', async () => {
    prismaMock.refreshSession.findUnique.mockResolvedValue({
      id: 'session-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
      user: {
        id: 'user-1',
        tenantId: 'tenant-1',
        username: 'demo-admin',
        email: 'admin@demo.local',
        passwordHash: activeUserPasswordHash,
        role: 'ADMIN',
        isActive: true
      }
    });

    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('X-Tenant-Slug', 'demo-tenant')
      .send({ refreshToken: 'refresh-token-1' })
      .expect(401);

    expect(response.body.message).toBe('Refresh token is revoked');
  });

  it('rejects expired refresh token', async () => {
    prismaMock.refreshSession.findUnique.mockResolvedValue({
      id: 'session-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() - 60_000),
      revokedAt: null,
      user: {
        id: 'user-1',
        tenantId: 'tenant-1',
        username: 'demo-admin',
        email: 'admin@demo.local',
        passwordHash: activeUserPasswordHash,
        role: 'ADMIN',
        isActive: true
      }
    });

    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('X-Tenant-Slug', 'demo-tenant')
      .send({ refreshToken: 'refresh-token-1' })
      .expect(401);

    expect(response.body.message).toBe('Refresh token is expired');
  });

  it('logs out by revoking the current refresh session', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('X-Tenant-Slug', 'demo-tenant')
      .send({ refreshToken: 'refresh-token-1' })
      .expect(200);

    expect(response.body).toEqual({ success: true });
    expect(prismaMock.refreshSession.updateMany).toHaveBeenCalledTimes(1);
  });

  it('rejects refresh after logout revokes the same token', async () => {
    let tokenRevoked = false;

    prismaMock.refreshSession.findUnique.mockImplementation(async () => ({
      id: 'session-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: tokenRevoked ? new Date() : null,
      user: {
        id: 'user-1',
        tenantId: 'tenant-1',
        username: 'demo-admin',
        email: 'admin@demo.local',
        passwordHash: activeUserPasswordHash,
        role: 'ADMIN',
        isActive: true
      }
    }));

    prismaMock.refreshSession.updateMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      if ('tenantId' in where) {
        tokenRevoked = true;
        return { count: 1 };
      }

      return { count: tokenRevoked ? 0 : 1 };
    });

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('X-Tenant-Slug', 'demo-tenant')
      .send({ refreshToken: 'refresh-token-1' })
      .expect(200);

    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('X-Tenant-Slug', 'demo-tenant')
      .send({ refreshToken: 'refresh-token-1' })
      .expect(401);

    expect(response.body.message).toBe('Refresh token is revoked');
  });

  it('returns current user profile for a valid access token', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .expect(200);

    expect(response.body.id).toBe('user-1');
    expect(response.body.username).toBe('demo-admin');
    expect(response.body.tenantId).toBe('tenant-1');
    expect(response.body.role).toBe('ADMIN');
  });

  it('rejects me route when token is missing', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('X-Tenant-Slug', 'demo-tenant')
      .expect(401);

    expect(response.body.message).toBe('Authorization header is required');
  });

  it('rejects me route when token tenant does not match request tenant', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-other-tenant')
      .expect(403);

    expect(response.body.message).toBe('Tenant mismatch between token and request context');
  });
});
