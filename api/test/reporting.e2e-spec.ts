import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ReservationStatus, UserRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('ReportingController (e2e)', () => {
  let app: INestApplication;

  const prismaMock = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    enableShutdownHooks: jest.fn(),
    isHealthy: jest.fn(),
    tenant: {
      findUnique: jest.fn()
    },
    ride: {
      count: jest.fn(),
      findMany: jest.fn()
    },
    line: {
      count: jest.fn(),
      findMany: jest.fn()
    },
    station: {
      count: jest.fn(),
      findMany: jest.fn()
    },
    passenger: {
      count: jest.fn(),
      findMany: jest.fn()
    },
    reservation: {
      findMany: jest.fn()
    },
    user: {
      findMany: jest.fn()
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

      if (token === 'access-token-staff') {
        return {
          sub: 'staff-1',
          tenantId: 'tenant-1',
          role: UserRole.STAFF,
          username: 'demo-staff'
        };
      }

      throw new Error('invalid token');
    });

    prismaMock.ride.count.mockResolvedValue(2);
    prismaMock.line.count.mockResolvedValue(3);
    prismaMock.station.count.mockResolvedValue(5);
    prismaMock.passenger.count.mockResolvedValue(7);

    prismaMock.reservation.findMany.mockResolvedValue([
      {
        travelDate: new Date('2026-03-10T00:00:00.000Z'),
        rideId: 'ride-1',
        rideDepartureTime: '09:00',
        status: ReservationStatus.ACTIVE,
        passengerId: 'passenger-1',
        ride: {
          capacity: 20,
          line: {
            id: 'line-1',
            name: 'Central - North'
          }
        }
      }
    ]);

    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.line.findMany.mockResolvedValue([]);
    prismaMock.station.findMany.mockResolvedValue([]);
    prismaMock.passenger.findMany.mockResolvedValue([]);
    prismaMock.ride.findMany.mockResolvedValue([]);

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

  it('returns dashboard metrics scoped to tenant context', async () => {
    const response = await request(app.getHttpServer())
      .get('/reporting/dashboard?fromDate=2026-03-01&toDate=2026-03-31')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .expect(200);

    expect(response.body.summary.activeRides).toBe(2);
    expect(prismaMock.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1'
        })
      })
    );
  });

  it('blocks staff users from audit endpoint', async () => {
    const response = await request(app.getHttpServer())
      .get('/reporting/audit?fromDate=2026-03-01&toDate=2026-03-31')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-staff')
      .expect(403);

    expect(response.body.message).toBe('Insufficient role for this resource');
  });

  it('allows admin users to query audit endpoint', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([
      {
        id: 'reservation-1',
        createdById: 'admin-1',
        updatedById: 'admin-1',
        createdAt: new Date('2026-03-10T00:00:00.000Z'),
        updatedAt: new Date('2026-03-10T00:00:00.000Z')
      }
    ]);

    const response = await request(app.getHttpServer())
      .get('/reporting/audit?entity=RESERVATIONS&fromDate=2026-03-01&toDate=2026-03-31')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .expect(200);

    expect(response.body.total).toBe(1);
    expect(response.body.items[0].entity).toBe('RESERVATIONS');
  });

  it('rejects invalid dashboard date range', async () => {
    const response = await request(app.getHttpServer())
      .get('/reporting/dashboard?fromDate=2026-04-01&toDate=2026-03-01')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .expect(400);

    expect(response.body.message).toBe('fromDate cannot be after toDate');
  });

  it('enforces tenant mismatch protection for reporting', async () => {
    const response = await request(app.getHttpServer())
      .get('/reporting/dashboard')
      .set('X-Tenant-Slug', 'other-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .expect(403);

    expect(response.body.message).toBe('Tenant mismatch between token and request context');
  });

  it('returns occupancy points and summary', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([
      {
        travelDate: new Date('2026-03-10T00:00:00.000Z'),
        rideId: 'ride-1',
        rideDepartureTime: '09:00',
        status: ReservationStatus.ACTIVE,
        passengerId: 'passenger-1',
        ride: {
          capacity: 10,
          line: {
            id: 'line-1',
            name: 'Central - North'
          }
        }
      }
    ]);

    const response = await request(app.getHttpServer())
      .get('/reporting/occupancy?fromDate=2026-03-01&toDate=2026-03-31&lineId=line-1')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .expect(200);

    expect(response.body.points).toHaveLength(1);
    expect(response.body.summary.overallUtilizationPercent).toBe(10);
  });
});
