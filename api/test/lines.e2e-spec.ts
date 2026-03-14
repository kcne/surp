import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { LineDirection, LineDirectionMode, UserRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('LinesController (e2e)', () => {
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
      findMany: jest.fn()
    },
    line: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
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

    prismaMock.station.findMany.mockResolvedValue([
      { id: 'station-a', name: 'Central Station' },
      { id: 'station-b', name: 'North Station' }
    ]);

    prismaMock.line.create.mockResolvedValue({
      id: 'line-1',
      tenantId: 'tenant-1',
      createdById: 'admin-1',
      updatedById: 'admin-1',
      name: 'Central Station - North Station',
      departureStationId: 'station-a',
      arrivalStationId: 'station-b',
      directionMode: LineDirectionMode.BOTH,
      direction: LineDirection.OUTBOUND,
      pairKey: 'central-north-1',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      departureStation: {
        id: 'station-a',
        name: 'Central Station',
        address: '1 Main Street',
        category: null,
        isActive: true
      },
      arrivalStation: {
        id: 'station-b',
        name: 'North Station',
        address: '2 Main Street',
        category: null,
        isActive: true
      }
    });

    prismaMock.$transaction.mockResolvedValue([
      [
        {
          id: 'line-1',
          tenantId: 'tenant-1',
          createdById: 'admin-1',
          updatedById: 'admin-1',
          name: 'Central Station - North Station',
          departureStationId: 'station-a',
          arrivalStationId: 'station-b',
          directionMode: LineDirectionMode.BOTH,
          direction: LineDirection.OUTBOUND,
          pairKey: 'central-north-1',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          departureStation: {
            id: 'station-a',
            name: 'Central Station',
            address: '1 Main Street',
            category: null,
            isActive: true
          },
          arrivalStation: {
            id: 'station-b',
            name: 'North Station',
            address: '2 Main Street',
            category: null,
            isActive: true
          }
        }
      ],
      1
    ]);

    prismaMock.line.findFirst.mockResolvedValue({
      id: 'line-1',
      tenantId: 'tenant-1',
      createdById: 'admin-1',
      updatedById: 'admin-1',
      name: 'Central Station - North Station',
      departureStationId: 'station-a',
      arrivalStationId: 'station-b',
      directionMode: LineDirectionMode.BOTH,
      direction: LineDirection.OUTBOUND,
      pairKey: 'central-north-1',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      departureStation: {
        id: 'station-a',
        name: 'Central Station',
        address: '1 Main Street',
        category: null,
        isActive: true
      },
      arrivalStation: {
        id: 'station-b',
        name: 'North Station',
        address: '2 Main Street',
        category: null,
        isActive: true
      }
    });

    prismaMock.line.update.mockResolvedValue({
      id: 'line-1',
      tenantId: 'tenant-1',
      createdById: 'admin-1',
      updatedById: 'admin-1',
      name: 'Central Station - North Station Updated',
      departureStationId: 'station-a',
      arrivalStationId: 'station-b',
      directionMode: LineDirectionMode.BOTH,
      direction: LineDirection.OUTBOUND,
      pairKey: 'central-north-1',
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      departureStation: {
        id: 'station-a',
        name: 'Central Station',
        address: '1 Main Street',
        category: null,
        isActive: true
      },
      arrivalStation: {
        id: 'station-b',
        name: 'North Station',
        address: '2 Main Street',
        category: null,
        isActive: true
      }
    });

    prismaMock.line.delete.mockResolvedValue({
      id: 'line-1',
      tenantId: 'tenant-1',
      createdById: 'admin-1',
      updatedById: 'admin-1',
      name: 'Central Station - North Station',
      departureStationId: 'station-a',
      arrivalStationId: 'station-b',
      directionMode: LineDirectionMode.BOTH,
      direction: LineDirection.OUTBOUND,
      pairKey: 'central-north-1',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      departureStation: {
        id: 'station-a',
        name: 'Central Station',
        address: '1 Main Street',
        category: null,
        isActive: true
      },
      arrivalStation: {
        id: 'station-b',
        name: 'North Station',
        address: '2 Main Street',
        category: null,
        isActive: true
      }
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

  it('prevents cross-tenant line access', async () => {
    const response = await request(app.getHttpServer())
      .get('/lines/line-1')
      .set('X-Tenant-Slug', 'other-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .expect(403);

    expect(response.body.message).toBe('Tenant mismatch between token and request context');
  });

  it('rejects create when station references are invalid', async () => {
    prismaMock.station.findMany.mockResolvedValueOnce([{ id: 'station-a', name: 'Central Station' }]);

    const response = await request(app.getHttpServer())
      .post('/lines')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .send({
        departureStationId: 'station-a',
        arrivalStationId: 'station-missing',
        directionMode: LineDirectionMode.SINGLE,
        direction: LineDirection.OUTBOUND
      })
      .expect(400);

    expect(response.body.message).toBe(
      'Departure and arrival stations must both exist in the current tenant'
    );
  });

  it('rejects create when direction logic is invalid', async () => {
    const response = await request(app.getHttpServer())
      .post('/lines')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .send({
        departureStationId: 'station-a',
        arrivalStationId: 'station-b',
        directionMode: LineDirectionMode.SINGLE,
        direction: LineDirection.OUTBOUND,
        pairKey: 'should-fail'
      })
      .expect(400);

    expect(response.body.message).toContain('pairKey is only allowed when directionMode is BOTH');
  });

  it('supports full line CRUD for tenant', async () => {
    const created = await request(app.getHttpServer())
      .post('/lines')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .send({
        departureStationId: 'station-a',
        arrivalStationId: 'station-b',
        directionMode: LineDirectionMode.BOTH,
        direction: LineDirection.OUTBOUND,
        pairKey: 'central-north-1',
        isActive: true
      })
      .expect(201);

    expect(created.body.id).toBe('line-1');

    const listed = await request(app.getHttpServer())
      .get('/lines')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .expect(200);

    expect(listed.body.total).toBe(1);

    prismaMock.line.findFirst
      .mockResolvedValueOnce({
        id: 'line-1',
        tenantId: 'tenant-1',
        createdById: 'admin-1',
        updatedById: 'admin-1',
        name: 'Central Station - North Station',
        departureStationId: 'station-a',
        arrivalStationId: 'station-b',
        directionMode: LineDirectionMode.BOTH,
        direction: LineDirection.OUTBOUND,
        pairKey: 'central-north-1',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        departureStation: {
          id: 'station-a',
          name: 'Central Station',
          address: '1 Main Street',
          category: null,
          isActive: true
        },
        arrivalStation: {
          id: 'station-b',
          name: 'North Station',
          address: '2 Main Street',
          category: null,
          isActive: true
        }
      })
      .mockResolvedValueOnce({
        id: 'line-1',
        name: 'Central Station - North Station',
        departureStationId: 'station-a',
        arrivalStationId: 'station-b',
        directionMode: LineDirectionMode.BOTH,
        direction: LineDirection.OUTBOUND,
        pairKey: 'central-north-1'
      })
      .mockResolvedValueOnce({
        id: 'line-1',
        name: 'Central Station - North Station',
        departureStationId: 'station-a',
        arrivalStationId: 'station-b',
        directionMode: LineDirectionMode.BOTH,
        direction: LineDirection.OUTBOUND,
        pairKey: 'central-north-1'
      });

    const detail = await request(app.getHttpServer())
      .get('/lines/line-1')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .expect(200);

    expect(detail.body.id).toBe('line-1');

    const updated = await request(app.getHttpServer())
      .patch('/lines/line-1')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .send({
        name: 'Central Station - North Station Updated',
        isActive: false
      })
      .expect(200);

    expect(updated.body.isActive).toBe(false);

    const removed = await request(app.getHttpServer())
      .delete('/lines/line-1')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .expect(200);

    expect(removed.body.id).toBe('line-1');
  });
});
