import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { DepartureSource, UserRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('DeparturesController (e2e)', () => {
  let app: INestApplication;

  const storedDeparture = {
    id: 'departure-1',
    rideId: 'ride-1',
    lineId: 'line-1',
    serviceDate: new Date('2026-10-05T00:00:00.000Z'),
    source: DepartureSource.EXTRA,
    departureTime: '09:00',
    arrivalTime: '11:00',
    capacity: 48,
    timetableDroppedAt: null,
    cancelledAt: new Date('2026-10-01T08:00:00.000Z'),
    cancelledById: 'admin-1',
    createdAt: new Date('2026-09-30T08:00:00.000Z'),
    updatedAt: new Date('2026-10-01T08:00:00.000Z'),
    ride: { name: 'Morning Central Route' },
    line: { name: 'Central - North' },
    stops: [
      {
        stationId: 'station-a',
        orderIndex: 0,
        time: '09:00',
        isBoarding: true,
        isDropoff: false,
        station: { name: 'Central' }
      },
      {
        stationId: 'station-m',
        orderIndex: 1,
        time: null,
        isBoarding: true,
        isDropoff: true,
        station: { name: 'Middle' }
      },
      {
        stationId: 'station-b',
        orderIndex: 2,
        time: '11:00',
        isBoarding: false,
        isDropoff: true,
        station: { name: 'North' }
      }
    ]
  };

  const prismaMock = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    enableShutdownHooks: jest.fn(),
    isHealthy: jest.fn(),
    tenant: { findUnique: jest.fn() },
    departure: { findMany: jest.fn(), findFirst: jest.fn() }
  };

  const tokens: Record<string, { sub: string; tenantId: string; role: UserRole; username: string }> = {
    'access-token-admin': { sub: 'admin-1', tenantId: 'tenant-1', role: UserRole.ADMIN, username: 'admin' },
    'access-token-manager': { sub: 'manager-1', tenantId: 'tenant-1', role: UserRole.MANAGER, username: 'manager' },
    'access-token-staff': { sub: 'staff-1', tenantId: 'tenant-1', role: UserRole.STAFF, username: 'staff' },
    'access-token-driver': { sub: 'driver-1', tenantId: 'tenant-1', role: UserRole.DRIVER, username: 'driver' },
    'access-token-superadmin': {
      sub: 'superadmin-1',
      tenantId: 'tenant-1',
      role: UserRole.SUPERADMIN,
      username: 'superadmin'
    }
  };

  const jwtServiceMock = {
    sign: jest.fn(() => 'access-token'),
    verify: jest.fn((token: string) => {
      if (tokens[token]) {
        return tokens[token];
      }
      throw new Error('invalid token');
    })
  };

  function get(path: string, token = 'access-token-admin', tenant = 'demo-tenant') {
    return request(app.getHttpServer())
      .get(path)
      .set('X-Tenant-Slug', tenant)
      .set('Authorization', `Bearer ${token}`);
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    prismaMock.tenant.findUnique.mockImplementation(async ({ where }: { where: { slug: string } }) => {
      if (where.slug === 'demo-tenant') {
        return { id: 'tenant-1', slug: 'demo-tenant', isActive: true };
      }
      if (where.slug === 'other-tenant') {
        return { id: 'tenant-2', slug: 'other-tenant', isActive: true };
      }
      return null;
    });
    prismaMock.departure.findMany.mockResolvedValue([storedDeparture]);
    prismaMock.departure.findFirst.mockResolvedValue(storedDeparture);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(JwtService)
      .useValue(jwtServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  describe('GET /departures', () => {
    it('lists the tenant departures in the range with their stops', async () => {
      const response = await get('/departures?from=2026-10-01&to=2026-10-31').expect(200);

      expect(response.body).toEqual({
        from: '2026-10-01',
        to: '2026-10-31',
        items: [
          {
            id: 'departure-1',
            rideId: 'ride-1',
            rideName: 'Morning Central Route',
            lineId: 'line-1',
            lineName: 'Central - North',
            serviceDate: '2026-10-05',
            source: 'EXTRA',
            departureTime: '09:00',
            arrivalTime: '11:00',
            capacity: 48,
            timetableDroppedAt: null,
            cancelledAt: '2026-10-01T08:00:00.000Z',
            cancelledById: 'admin-1',
            stops: [
              { stationId: 'station-a', stationName: 'Central', orderIndex: 0, time: '09:00', isBoarding: true, isDropoff: false },
              { stationId: 'station-m', stationName: 'Middle', orderIndex: 1, time: null, isBoarding: true, isDropoff: true },
              { stationId: 'station-b', stationName: 'North', orderIndex: 2, time: '11:00', isBoarding: false, isDropoff: true }
            ],
            createdAt: '2026-09-30T08:00:00.000Z',
            updatedAt: '2026-10-01T08:00:00.000Z'
          }
        ]
      });

      const { where, orderBy } = prismaMock.departure.findMany.mock.calls[0][0];
      expect(where).toEqual({
        tenantId: 'tenant-1',
        serviceDate: {
          gte: new Date('2026-10-01T00:00:00.000Z'),
          lte: new Date('2026-10-31T00:00:00.000Z')
        }
      });
      expect(orderBy).toEqual([{ serviceDate: 'asc' }, { departureTime: 'asc' }, { id: 'asc' }]);
    });

    it('filters by ride and line', async () => {
      await get('/departures?from=2026-10-01&to=2026-10-01&rideId=ride-1&lineId=line-1').expect(200);

      expect(prismaMock.departure.findMany.mock.calls[0][0].where).toMatchObject({
        tenantId: 'tenant-1',
        rideId: 'ride-1',
        lineId: 'line-1'
      });
    });

    it('accepts a range of exactly 62 days', async () => {
      await get('/departures?from=2026-10-01&to=2026-12-01').expect(200);
    });

    it.each([
      ['a range of 63 days', 'from=2026-10-01&to=2026-12-02', 'A range covers at most 62 days'],
      ['to before from', 'from=2026-10-02&to=2026-10-01', 'to must not be before from'],
      ['a date that does not exist', 'from=2026-02-30&to=2026-03-02', 'from and to must be real dates'],
      ['year 0000, which Postgres cannot store', 'from=0000-01-01&to=0000-01-02', 'from and to must be real dates']
    ])('refuses %s with 400', async (_case, queryString, message) => {
      const response = await get(`/departures?${queryString}`).expect(400);

      expect(response.body.message).toBe(message);
      expect(prismaMock.departure.findMany).not.toHaveBeenCalled();
    });

    it.each([
      ['a missing to', 'from=2026-10-01'],
      ['a malformed date', 'from=01.10.2026&to=2026-10-31'],
      ['an unknown filter', 'from=2026-10-01&to=2026-10-31&status=ACTIVE'],
      ['a source filter, which the list does not take', 'from=2026-10-01&to=2026-10-31&source=LEGACY'],
      ['an empty ride filter', 'from=2026-10-01&to=2026-10-31&rideId='],
      ['a whitespace line filter', 'from=2026-10-01&to=2026-10-31&lineId=%20']
    ])('refuses %s with 400', async (_case, queryString) => {
      await get(`/departures?${queryString}`).expect(400);

      expect(prismaMock.departure.findMany).not.toHaveBeenCalled();
    });

    it.each(['access-token-manager', 'access-token-staff', 'access-token-driver'])(
      'is readable with %s',
      async (token) => {
        await get('/departures?from=2026-10-01&to=2026-10-31', token).expect(200);
      }
    );

    it('refuses a role outside the agency', async () => {
      await get('/departures?from=2026-10-01&to=2026-10-31', 'access-token-superadmin').expect(403);

      expect(prismaMock.departure.findMany).not.toHaveBeenCalled();
    });

    it('refuses a token of another tenant', async () => {
      await get('/departures?from=2026-10-01&to=2026-10-31', 'access-token-admin', 'other-tenant').expect(403);

      expect(prismaMock.departure.findMany).not.toHaveBeenCalled();
    });

    it('refuses a request without a token', async () => {
      await request(app.getHttpServer())
        .get('/departures?from=2026-10-01&to=2026-10-31')
        .set('X-Tenant-Slug', 'demo-tenant')
        .expect(401);
    });
  });

  describe('GET /departures/:id', () => {
    it('returns the departure, looked up within the tenant', async () => {
      const response = await get('/departures/departure-1', 'access-token-driver').expect(200);

      expect(response.body).toMatchObject({ id: 'departure-1', serviceDate: '2026-10-05', source: 'EXTRA' });
      expect(prismaMock.departure.findFirst.mock.calls[0][0].where).toEqual({
        id: 'departure-1',
        tenantId: 'tenant-1'
      });
    });

    it('answers 404 for a departure the tenant does not have', async () => {
      prismaMock.departure.findFirst.mockResolvedValue(null);

      const response = await get('/departures/departure-x').expect(404);

      expect(response.body.message).toBe('Departure not found');
    });

    it('refuses a role outside the agency', async () => {
      await get('/departures/departure-1', 'access-token-superadmin').expect(403);

      expect(prismaMock.departure.findFirst).not.toHaveBeenCalled();
    });
  });
});
