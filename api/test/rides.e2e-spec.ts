import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { RideExceptionType, RideStatus, RideType, UserRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('RidesController (e2e)', () => {
  let app: INestApplication;

  const baseRide = {
    id: 'ride-1',
    tenantId: 'tenant-1',
    lineId: 'line-1',
    createdById: 'admin-1',
    updatedById: 'admin-1',
    name: 'Morning Central Route',
    capacity: 38,
    type: RideType.RECURRING,
    status: RideStatus.DRAFT,
    recurringStartDate: new Date('2026-03-20T00:00:00.000Z'),
    recurringEndDate: null,
    oneTimeDate: null,
    oneTimeDepartureTime: null,
    oneTimeArrivalTime: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    line: {
      id: 'line-1',
      name: 'Central - North',
      departureStationId: 'station-a',
      arrivalStationId: 'station-b',
      intermediateStops: []
    },
    daySchedules: [
      {
        dayOfWeek: 1,
        stationTimes: [
          { stationId: 'station-a', orderIndex: 0, time: '09:00' },
          { stationId: 'station-b', orderIndex: 1, time: '10:30' }
        ]
      }
    ],
    exceptions: [] as Array<{
      id: string;
      exceptionDate: Date;
      type: RideExceptionType;
      departureTime: string | null;
      arrivalTime: string | null;
      createdById: string | null;
      updatedById: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>
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
    line: {
      findFirst: jest.fn()
    },
    ride: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    rideDaySchedule: {
      create: jest.fn(),
      deleteMany: jest.fn()
    },
    rideException: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn()
    },
    reservation: {
      groupBy: jest.fn(),
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

    prismaMock.line.findFirst.mockResolvedValue({
      id: 'line-1',
      name: 'Central - North',
      departureStationId: 'station-a',
      arrivalStationId: 'station-b',
      intermediateStops: []
    });

    prismaMock.ride.create.mockResolvedValue({ id: 'ride-1' });
    prismaMock.ride.findFirst.mockResolvedValue({ ...baseRide });
    prismaMock.ride.findMany.mockResolvedValue([{ ...baseRide }]);
    prismaMock.ride.count.mockResolvedValue(1);
    prismaMock.ride.update.mockResolvedValue({ ...baseRide });
    prismaMock.ride.delete.mockResolvedValue({ ...baseRide });

    prismaMock.rideDaySchedule.create.mockResolvedValue({ id: 'schedule-1' });
    prismaMock.rideDaySchedule.deleteMany.mockResolvedValue({ count: 1 });

    prismaMock.rideException.findMany.mockResolvedValue([]);
    prismaMock.rideException.findFirst.mockResolvedValue({ id: 'exception-1' });
    prismaMock.rideException.create.mockResolvedValue({
      id: 'exception-1',
      exceptionDate: new Date('2026-03-25T00:00:00.000Z'),
      type: RideExceptionType.SKIP,
      departureTime: null,
      arrivalTime: null,
      createdById: 'admin-1',
      updatedById: 'admin-1',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    prismaMock.rideException.delete.mockResolvedValue({
      id: 'exception-1',
      exceptionDate: new Date('2026-03-25T00:00:00.000Z'),
      type: RideExceptionType.SKIP,
      departureTime: null,
      arrivalTime: null,
      createdById: 'admin-1',
      updatedById: 'admin-1',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    prismaMock.reservation.groupBy.mockResolvedValue([]);
    prismaMock.reservation.count.mockResolvedValue(0);

    prismaMock.$transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') {
        return arg({
          ride: prismaMock.ride,
          rideDaySchedule: prismaMock.rideDaySchedule
        });
      }

      return [[{ ...baseRide }], 1];
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

  it('prevents cross-tenant ride access', async () => {
    const response = await request(app.getHttpServer())
      .get('/rides/ride-1')
      .set('X-Tenant-Slug', 'other-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .expect(403);

    expect(response.body.message).toBe('Tenant mismatch between token and request context');
  });

  it('requires day schedules for recurring rides', async () => {
    const response = await request(app.getHttpServer())
      .post('/rides')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .send({
        lineId: 'line-1',
        capacity: 38,
        type: RideType.RECURRING,
        recurringStartDate: '2026-03-20'
      })
      .expect(400);

    expect(response.body.message).toBe('Recurring rides require at least one day schedule definition');
  });

  it('requires date and times for one-time rides', async () => {
    const response = await request(app.getHttpServer())
      .post('/rides')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .send({
        lineId: 'line-1',
        capacity: 38,
        type: RideType.ONE_TIME,
        oneTimeDate: '2026-03-20'
      })
      .expect(400);

    expect(response.body.message).toBe(
      'One-time rides require oneTimeDate, oneTimeDepartureTime and oneTimeArrivalTime'
    );
  });

  it('allows overnight recurring day schedules', async () => {
    const response = await request(app.getHttpServer())
      .post('/rides')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .send({
        lineId: 'line-1',
        capacity: 38,
        type: RideType.RECURRING,
        status: RideStatus.ACTIVE,
        recurringStartDate: '2026-03-20',
        daySchedules: [
          {
            dayOfWeek: 1,
            stationTimes: [
              { stationId: 'station-a', orderIndex: 0, time: '12:00' },
              { stationId: 'station-b', orderIndex: 1, time: '00:00' }
            ]
          }
        ]
      })
      .expect(201);

    expect(response.body.id).toBe('ride-1');
  });

  it('rejects invalid exception combinations', async () => {
    prismaMock.rideException.findMany.mockResolvedValueOnce([
      {
        id: 'exception-existing-skip',
        type: RideExceptionType.SKIP,
        departureTime: null,
        arrivalTime: null
      }
    ]);

    const response = await request(app.getHttpServer())
      .post('/rides/ride-1/exceptions')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .send({
        date: '2026-03-25',
        type: RideExceptionType.ADDITIONAL,
        departureTime: '11:00',
        arrivalTime: '12:00'
      })
      .expect(409);

    expect(response.body.message).toBe('Cannot mix SKIP and ADDITIONAL exceptions on the same date');
  });

  it('supports ride CRUD with status transitions', async () => {
    const created = await request(app.getHttpServer())
      .post('/rides')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .send({
        lineId: 'line-1',
        capacity: 38,
        type: RideType.RECURRING,
        status: RideStatus.DRAFT,
        recurringStartDate: '2026-03-20',
        daySchedules: [
          {
            dayOfWeek: 1,
            stationTimes: [
              { stationId: 'station-a', orderIndex: 0, time: '09:00' },
              { stationId: 'station-b', orderIndex: 1, time: '10:30' }
            ]
          }
        ]
      })
      .expect(201);

    expect(created.body.id).toBe('ride-1');

    const listed = await request(app.getHttpServer())
      .get('/rides?status=DRAFT&type=RECURRING')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .expect(200);

    expect(listed.body.total).toBe(1);

    const activatedRide = {
      ...baseRide,
      status: RideStatus.ACTIVE
    };

    prismaMock.ride.findFirst.mockResolvedValueOnce({ ...baseRide });
    prismaMock.ride.findFirst.mockResolvedValueOnce(activatedRide);

    const activated = await request(app.getHttpServer())
      .patch('/rides/ride-1')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .send({ status: RideStatus.ACTIVE })
      .expect(200);

    expect(activated.body.status).toBe(RideStatus.ACTIVE);

    prismaMock.ride.findFirst.mockResolvedValueOnce(activatedRide);

    const removed = await request(app.getHttpServer())
      .delete('/rides/ride-1')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .expect(200);

    expect(removed.body.id).toBe('ride-1');
  });

  it('lists materialized ride instances for date query', async () => {
    prismaMock.ride.findMany.mockResolvedValueOnce([
      {
        id: 'ride-1',
        tenantId: 'tenant-1',
        lineId: 'line-1',
        name: 'Morning Central Route',
        capacity: 38,
        type: RideType.RECURRING,
        status: RideStatus.ACTIVE,
        recurringStartDate: new Date('2026-03-20T00:00:00.000Z'),
        recurringEndDate: null,
        oneTimeDate: null,
        oneTimeDepartureTime: null,
        oneTimeArrivalTime: null,
        line: {
          id: 'line-1',
          name: 'Central - North',
          departureStationId: 'station-a',
          arrivalStationId: 'station-b',
          intermediateStops: []
        },
        daySchedules: [
          {
            dayOfWeek: 1,
            stationTimes: [
              { stationId: 'station-a', orderIndex: 0, time: '09:00' },
              { stationId: 'station-b', orderIndex: 1, time: '10:30' }
            ]
          }
        ],
        exceptions: []
      }
    ]);

    const response = await request(app.getHttpServer())
      .get('/rides/instances?date=2026-03-30&timezoneOffsetMinutes=0')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .expect(200);

    expect(response.body.date).toBe('2026-03-30');
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].source).toBe('BASE');
    expect(response.body.items[0].reservationCount).toBe(0);
  });

  it('validates ride instances date query format', async () => {
    await request(app.getHttpServer())
      .get('/rides/instances?date=2026/03/30')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .expect(400);
  });
});
