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

  const prismaMock = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    enableShutdownHooks: jest.fn(),
    isHealthy: jest.fn(),
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
    sign: jest.fn(() => 'access-token')
  };

  beforeAll(async () => {
    activeUserPasswordHash = await hash('demo-admin-pass', 10);
    inactiveUserPasswordHash = await hash('demo-inactive-pass', 10);
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    prismaMock.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      slug: 'demo-tenant',
      isActive: true
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

    prismaMock.refreshSession.create.mockResolvedValue({ id: 'session-1' });

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
});
