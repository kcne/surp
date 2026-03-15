import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('PlatformTenantsController (e2e)', () => {
  let app: INestApplication;

  const createdAt = new Date('2026-03-14T10:00:00.000Z');
  const updatedAt = new Date('2026-03-14T10:05:00.000Z');

  const prismaMock = {
    $transaction: jest.fn(),
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    enableShutdownHooks: jest.fn(),
    isHealthy: jest.fn(),
    tenant: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn()
    }
  };

  const jwtServiceMock = {
    sign: jest.fn(() => 'access-token'),
    verify: jest.fn()
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    jwtServiceMock.verify.mockImplementation((token: string) => {
      if (token === 'access-token-superadmin') {
        return {
          sub: 'superadmin-1',
          tenantId: 'platform-tenant-1',
          role: UserRole.SUPERADMIN,
          username: 'platform-superadmin'
        };
      }

      if (token === 'access-token-admin') {
        return {
          sub: 'admin-1',
          tenantId: 'tenant-1',
          role: UserRole.ADMIN,
          username: 'demo-admin'
        };
      }

      throw new Error('invalid token');
    });

    prismaMock.$transaction.mockResolvedValue([[], 0]);

    prismaMock.tenant.create.mockResolvedValue({
      id: 'tenant-acme',
      slug: 'acme-transit',
      name: 'Acme Transit',
      isActive: true,
      deactivatedAt: null,
      deactivatedById: null,
      createdAt,
      updatedAt
    });

    prismaMock.tenant.findMany.mockResolvedValue([
      {
        id: 'tenant-acme',
        slug: 'acme-transit',
        name: 'Acme Transit',
        isActive: true,
        deactivatedAt: null,
        deactivatedById: null,
        createdAt,
        updatedAt
      }
    ]);

    prismaMock.tenant.count.mockResolvedValue(1);

    prismaMock.tenant.findUnique.mockImplementation(({ where }: { where: { id?: string } }) => {
      if (where?.id === 'tenant-acme' || where?.id === 'tenant-inactive') {
        return Promise.resolve({ id: where.id });
      }

      return Promise.resolve(null);
    });

    prismaMock.tenant.update.mockImplementation(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      if (where.id === 'tenant-acme') {
        return Promise.resolve({
          id: 'tenant-acme',
          slug: 'acme-transit',
          name: 'Acme Transit',
          isActive: data.isActive ?? true,
          deactivatedAt: (data.deactivatedAt as Date | null | undefined) ?? null,
          deactivatedById: (data.deactivatedById as string | null | undefined) ?? null,
          createdAt,
          updatedAt
        });
      }

      return Promise.resolve({
        id: 'tenant-inactive',
        slug: 'inactive-tenant',
        name: 'Inactive Tenant',
        isActive: data.isActive ?? false,
        deactivatedAt: (data.deactivatedAt as Date | null | undefined) ?? new Date(),
        deactivatedById: (data.deactivatedById as string | null | undefined) ?? 'superadmin-1',
        createdAt,
        updatedAt
      });
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(JwtService)
      .useValue(jwtServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true
      })
    );
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('superadmin can create tenant without tenant header', async () => {
    const response = await request(app.getHttpServer())
      .post('/platform/tenants')
      .set('Authorization', 'Bearer access-token-superadmin')
      .send({
        slug: 'acme-transit',
        name: 'Acme Transit'
      })
      .expect(201);

    expect(response.body.slug).toBe('acme-transit');
    expect(response.body.isActive).toBe(true);
  });

  it('non-superadmin cannot manage platform tenants', async () => {
    await request(app.getHttpServer())
      .post('/platform/tenants')
      .set('Authorization', 'Bearer access-token-admin')
      .send({
        slug: 'beta-transit',
        name: 'Beta Transit'
      })
      .expect(403);
  });

  it('superadmin can deactivate and reactivate tenant', async () => {
    const deactivateResponse = await request(app.getHttpServer())
      .patch('/platform/tenants/tenant-acme/deactivate')
      .set('Authorization', 'Bearer access-token-superadmin')
      .expect(200);

    expect(deactivateResponse.body.isActive).toBe(false);
    expect(deactivateResponse.body.deactivatedById).toBe('superadmin-1');

    const activateResponse = await request(app.getHttpServer())
      .patch('/platform/tenants/tenant-acme/activate')
      .set('Authorization', 'Bearer access-token-superadmin')
      .expect(200);

    expect(activateResponse.body.isActive).toBe(true);
    expect(activateResponse.body.deactivatedAt).toBeNull();
  });

  it('returns 404 for missing tenant id', async () => {
    await request(app.getHttpServer())
      .patch('/platform/tenants/tenant-missing/deactivate')
      .set('Authorization', 'Bearer access-token-superadmin')
      .expect(404);
  });
});
