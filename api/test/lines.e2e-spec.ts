import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { LineDirection, LineDirectionMode, UserRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('LinesController (e2e)', () => {
  let app: INestApplication;

  const baseLine = {
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
    },
    intermediateStops: [] as Array<{ stationId: string; orderIndex: number; station: { name: string } }>
  };

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
    },
    lineStop: {
      createMany: jest.fn(),
      deleteMany: jest.fn()
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

    prismaMock.station.findMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) => {
      const allStations = [
        { id: 'station-a', name: 'Central Station' },
        { id: 'station-b', name: 'North Station' },
        { id: 'station-c', name: 'Midway 1' },
        { id: 'station-d', name: 'Midway 2' }
      ];
      return allStations.filter((station) => where.id.in.includes(station.id));
    });

    prismaMock.line.create.mockResolvedValue({ id: 'line-1' });
    prismaMock.line.findFirst.mockResolvedValue({ ...baseLine });
    prismaMock.line.findMany.mockResolvedValue([]);
    prismaMock.line.count.mockResolvedValue(1);
    prismaMock.line.update.mockResolvedValue({ ...baseLine });
    prismaMock.line.delete.mockResolvedValue({ ...baseLine });
    prismaMock.lineStop.createMany.mockResolvedValue({ count: 0 });
    prismaMock.lineStop.deleteMany.mockResolvedValue({ count: 0 });

    prismaMock.$transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') {
        return arg({
          line: prismaMock.line,
          lineStop: prismaMock.lineStop
        });
      }

      return [[{ ...baseLine }], 1];
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

  it('rejects duplicate order index in intermediate stops', async () => {
    const response = await request(app.getHttpServer())
      .post('/lines')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .send({
        departureStationId: 'station-a',
        arrivalStationId: 'station-b',
        intermediateStops: [
          { stationId: 'station-c', orderIndex: 1 },
          { stationId: 'station-d', orderIndex: 1 }
        ]
      })
      .expect(400);

    expect(response.body.message).toBe('Duplicate order index in intermediate stops is not allowed');
  });

  it('rejects duplicate station in intermediate stops', async () => {
    const response = await request(app.getHttpServer())
      .post('/lines')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .send({
        departureStationId: 'station-a',
        arrivalStationId: 'station-b',
        intermediateStops: [
          { stationId: 'station-c', orderIndex: 1 },
          { stationId: 'station-c', orderIndex: 2 }
        ]
      })
      .expect(400);

    expect(response.body.message).toBe('Duplicate station in intermediate stops is not allowed');
  });

  it('prevents duplicate reverse line creation', async () => {
    prismaMock.line.findFirst.mockResolvedValueOnce({
      ...baseLine,
      intermediateStops: [
        { stationId: 'station-c', orderIndex: 1, station: { name: 'Midway 1' } },
        { stationId: 'station-d', orderIndex: 2, station: { name: 'Midway 2' } }
      ]
    });

    prismaMock.line.findMany.mockResolvedValueOnce([
      {
        id: 'line-reverse-existing',
        intermediateStops: [
          { stationId: 'station-d', orderIndex: 1 },
          { stationId: 'station-c', orderIndex: 2 }
        ]
      }
    ]);

    const response = await request(app.getHttpServer())
      .post('/lines/line-1/reverse')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .expect(409);

    expect(response.body.message).toBe('Reverse line already exists for this route');
  });
});
