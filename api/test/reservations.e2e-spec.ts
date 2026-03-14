import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ReservationStatus, UserRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('ReservationsController (e2e)', () => {
  let app: INestApplication;

  const baseReservation = {
    id: 'reservation-1',
    tenantId: 'tenant-1',
    rideId: 'ride-1',
    passengerId: 'passenger-1',
    createdById: 'admin-1',
    updatedById: 'admin-1',
    travelDate: new Date('2026-03-30T00:00:00.000Z'),
    rideDepartureTime: '09:00',
    rideArrivalTime: '10:30',
    seatNumber: 12,
    status: ReservationStatus.ACTIVE,
    cancelledAt: null,
    departureStationId: 'station-a',
    arrivalStationId: 'station-c',
    createdAt: new Date(),
    updatedAt: new Date(),
    ride: {
      id: 'ride-1',
      name: 'Morning Ride',
      lineId: 'line-1'
    },
    passenger: {
      id: 'passenger-1',
      firstName: 'Mila',
      lastName: 'Markovic',
      phone: '+381640000111'
    },
    departureStation: {
      id: 'station-a',
      name: 'Central Station'
    },
    arrivalStation: {
      id: 'station-c',
      name: 'Midway Station'
    }
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
    reservation: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn()
    },
    ride: {
      findFirst: jest.fn()
    },
    passenger: {
      findFirst: jest.fn()
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

    prismaMock.ride.findFirst.mockResolvedValue({
      id: 'ride-1',
      line: {
        departureStationId: 'station-a',
        arrivalStationId: 'station-d',
        intermediateStops: [
          { stationId: 'station-b', orderIndex: 1 },
          { stationId: 'station-c', orderIndex: 2 }
        ]
      }
    });

    prismaMock.passenger.findFirst.mockResolvedValue({ id: 'passenger-1' });
    prismaMock.reservation.findMany.mockResolvedValue([]);

    prismaMock.reservation.create.mockResolvedValue({ ...baseReservation });
    prismaMock.reservation.findFirst.mockResolvedValue({ ...baseReservation });
    prismaMock.reservation.update.mockResolvedValue({
      ...baseReservation,
      status: ReservationStatus.CANCELLED,
      cancelledAt: new Date(),
      updatedById: 'admin-1'
    });

    prismaMock.$transaction.mockResolvedValue([[{ ...baseReservation }], 1]);

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

  it('prevents cross-tenant reservation access', async () => {
    const response = await request(app.getHttpServer())
      .get('/reservations/reservation-1')
      .set('X-Tenant-Slug', 'other-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .expect(403);

    expect(response.body.message).toBe('Tenant mismatch between token and request context');
  });

  it('fails when seat already booked for overlapping segment', async () => {
    prismaMock.reservation.findMany.mockResolvedValueOnce([
      {
        id: 'reservation-existing',
        departureStationId: 'station-b',
        arrivalStationId: 'station-d'
      }
    ]);

    const response = await request(app.getHttpServer())
      .post('/reservations')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .send({
        rideId: 'ride-1',
        passengerId: 'passenger-1',
        travelDate: '2026-03-30',
        rideDepartureTime: '09:00',
        rideArrivalTime: '10:30',
        seatNumber: 12,
        departureStationId: 'station-a',
        arrivalStationId: 'station-c'
      })
      .expect(409);

    expect(response.body.message).toBe('Seat is already booked for this route segment');
  });

  it('fails when departure or arrival path is invalid', async () => {
    const response = await request(app.getHttpServer())
      .post('/reservations')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .send({
        rideId: 'ride-1',
        passengerId: 'passenger-1',
        travelDate: '2026-03-30',
        rideDepartureTime: '09:00',
        rideArrivalTime: '10:30',
        seatNumber: 13,
        departureStationId: 'station-z',
        arrivalStationId: 'station-c'
      })
      .expect(400);

    expect(response.body.message).toBe('Departure and arrival stations must exist on the ride line path');
  });

  it('cancels reservation and updates state', async () => {
    const response = await request(app.getHttpServer())
      .post('/reservations/reservation-1/cancel')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .expect(201);

    expect(response.body.status).toBe(ReservationStatus.CANCELLED);
    expect(prismaMock.reservation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'reservation-1'
        },
        data: expect.objectContaining({
          status: ReservationStatus.CANCELLED,
          updatedById: 'admin-1'
        })
      })
    );
  });

  it('soft deletes reservation via delete endpoint', async () => {
    const response = await request(app.getHttpServer())
      .delete('/reservations/reservation-1')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .expect(200);

    expect(response.body.status).toBe(ReservationStatus.CANCELLED);
    expect(prismaMock.reservation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'reservation-1'
        },
        data: expect.objectContaining({
          status: ReservationStatus.CANCELLED,
          updatedById: 'admin-1'
        })
      })
    );
  });
});
