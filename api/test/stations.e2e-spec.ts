import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { StationCategory, UserRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('StationsController (e2e)', () => {
  let app: INestApplication;

  const prismaMock = {
    $transaction: jest.fn(),
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    enableShutdownHooks: jest.fn(),
    isHealthy: jest.fn(),
    tenant: {
      findUnique: jest.fn()
    },
    station: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    line: {
      count: jest.fn()
    },
    reservation: {
      count: jest.fn()
    }
  };

  const jwtServiceMock = {
    sign: jest.fn(() => 'access-token'),
    verify: jest.fn()
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prismaMock.tenant.findUnique.mockImplementation(async ({ where }: { where: { slug: string } }) => {
      if (where.slug === 'demo-tenant') {
        return {
          id: 'tenant-1',
          slug: 'demo-tenant',
          isActive: true
        };
      }

      if (where.slug === 'other-tenant') {
        return {
          id: 'tenant-2',
          slug: 'other-tenant',
          isActive: true
        };
      }

      return null;
    });

    jwtServiceMock.verify.mockImplementation((token: string) => {
      if (token === 'access-token-admin') {
        return {
          sub: 'admin-1',
          tenantId: 'tenant-1',
          role: UserRole.ADMIN,
          username: 'demo-admin'
        };
      }

      if (token === 'access-token-admin-other') {
        return {
          sub: 'admin-2',
          tenantId: 'tenant-2',
          role: UserRole.ADMIN,
          username: 'other-admin'
        };
      }

      throw new Error('invalid token');
    });

    prismaMock.station.create.mockResolvedValue({
      id: 'station-1',
      tenantId: 'tenant-1',
      createdById: 'admin-1',
      updatedById: 'admin-1',
      name: 'Central Station',
      address: '1 Main Street',
      category: StationCategory.BUS_STATION,
      contactPhone: null,
      notes: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    prismaMock.$transaction.mockResolvedValue([
      [
        {
          id: 'station-1',
          tenantId: 'tenant-1',
          createdById: 'admin-1',
          updatedById: 'admin-1',
          name: 'Central Station',
          address: '1 Main Street',
          category: StationCategory.BUS_STATION,
          contactPhone: null,
          notes: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ],
      1
    ]);

    prismaMock.station.findFirst.mockResolvedValue({ id: 'station-1' });
    prismaMock.station.update.mockResolvedValue({
      id: 'station-1',
      tenantId: 'tenant-1',
      createdById: 'admin-1',
      updatedById: 'admin-1',
      name: 'Central Station Updated',
      address: '10 Main Street',
      category: StationCategory.BUS_STOP,
      contactPhone: null,
      notes: null,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    prismaMock.station.delete.mockResolvedValue({
      id: 'station-1',
      tenantId: 'tenant-1',
      createdById: 'admin-1',
      updatedById: 'admin-1',
      name: 'Central Station',
      address: '1 Main Street',
      category: StationCategory.BUS_STATION,
      contactPhone: null,
      notes: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
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

  it('prevents cross-tenant station access', async () => {
    const response = await request(app.getHttpServer())
      .get('/stations/station-1')
      .set('X-Tenant-Slug', 'other-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .expect(403);

    expect(response.body.message).toBe('Tenant mismatch between token and request context');
  });

  it('returns validation errors for invalid payload', async () => {
    const response = await request(app.getHttpServer())
      .post('/stations')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .send({
        address: '1 Main Street'
      })
      .expect(400);

    expect(response.body.message).toEqual(
      expect.arrayContaining([
        'name should not be empty',
        'name must be a string'
      ])
    );
  });

  it('rejects delete when station is referenced by line or reservation', async () => {
    prismaMock.$transaction
      .mockResolvedValueOnce([1, 0])
      .mockResolvedValueOnce([0, 1]);

    const lineLinked = await request(app.getHttpServer())
      .delete('/stations/station-1')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .expect(409);

    expect(lineLinked.body.message).toContain('referenced by at least one line or reservation');

    const reservationLinked = await request(app.getHttpServer())
      .delete('/stations/station-1')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .expect(409);

    expect(reservationLinked.body.message).toContain('referenced by at least one line or reservation');
  });

  it('supports full station CRUD for tenant', async () => {
    const created = await request(app.getHttpServer())
      .post('/stations')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .send({
        name: 'Central Station',
        address: '1 Main Street',
        category: StationCategory.BUS_STATION,
        isActive: true
      })
      .expect(201);

    expect(created.body.name).toBe('Central Station');

    const listed = await request(app.getHttpServer())
      .get('/stations')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .expect(200);

    expect(listed.body.total).toBe(1);

    prismaMock.station.findFirst.mockResolvedValueOnce({
      id: 'station-1',
      tenantId: 'tenant-1',
      createdById: 'admin-1',
      updatedById: 'admin-1',
      name: 'Central Station',
      address: '1 Main Street',
      category: StationCategory.BUS_STATION,
      contactPhone: null,
      notes: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const detail = await request(app.getHttpServer())
      .get('/stations/station-1')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .expect(200);

    expect(detail.body.id).toBe('station-1');

    const updated = await request(app.getHttpServer())
      .patch('/stations/station-1')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .send({
        name: 'Central Station Updated',
        isActive: false
      })
      .expect(200);

    expect(updated.body.isActive).toBe(false);

    prismaMock.$transaction.mockResolvedValueOnce([0, 0]);

    const removed = await request(app.getHttpServer())
      .delete('/stations/station-1')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .expect(200);

    expect(removed.body.id).toBe('station-1');
  });
});
