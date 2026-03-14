import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ReservationStatus, UserRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

type ReservationStoreItem = {
  id: string;
  tenantId: string;
  rideId: string;
  passengerId: string;
  createdById: string | null;
  updatedById: string | null;
  travelDate: Date;
  rideDepartureTime: string;
  rideArrivalTime: string;
  seatNumber: number;
  status: ReservationStatus;
  cancelledAt: Date | null;
  departureStationId: string;
  arrivalStationId: string;
  createdAt: Date;
  updatedAt: Date;
  ride: {
    id: string;
    name: string;
    lineId: string;
  };
  passenger: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
  departureStation: {
    id: string;
    name: string;
  };
  arrivalStation: {
    id: string;
    name: string;
  };
};

describe('ReservationsController (e2e)', () => {
  let app: INestApplication;
  let reservationStore: ReservationStoreItem[];
  let transactionQueue: Promise<void>;
  let rideCapacity = 38;

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
    $executeRaw: jest.fn(),
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
    reservationStore = [];
    transactionQueue = Promise.resolve();
    rideCapacity = 38;

    prismaMock.$executeRaw.mockResolvedValue(1);

    prismaMock.$transaction.mockImplementation(async (input: unknown) => {
      if (typeof input === 'function') {
        const previous = transactionQueue;
        let release: () => void = () => undefined;
        const snapshot = reservationStore.map((item) => ({ ...item }));
        transactionQueue = new Promise<void>((resolve) => {
          release = resolve;
        });

        await previous;

        try {
          return await (input as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock);
        } catch (error) {
          reservationStore = snapshot;
          throw error;
        } finally {
          release();
        }
      }

      return Promise.all(input as Promise<unknown>[]);
    });

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
      capacity: rideCapacity,
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

    prismaMock.reservation.findMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      return reservationStore
        .filter((item) => {
          if (where.tenantId && item.tenantId !== where.tenantId) {
            return false;
          }

          if (where.rideId && item.rideId !== where.rideId) {
            return false;
          }

          if (where.rideDepartureTime && item.rideDepartureTime !== where.rideDepartureTime) {
            return false;
          }

          if (where.seatNumber !== undefined && item.seatNumber !== where.seatNumber) {
            return false;
          }

          if (where.status && item.status !== where.status) {
            return false;
          }

          if (where.travelDate && item.travelDate.toISOString() !== (where.travelDate as Date).toISOString()) {
            return false;
          }

          if (where.id && typeof where.id === 'object' && where.id !== null && 'not' in where.id) {
            if (item.id === (where.id as { not: string }).not) {
              return false;
            }
          }

          return true;
        })
        .map((item) => ({
          id: item.id,
          seatNumber: item.seatNumber,
          departureStationId: item.departureStationId,
          arrivalStationId: item.arrivalStationId
        }));
    });

    prismaMock.reservation.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      const created = {
        ...baseReservation,
        id: `reservation-${reservationStore.length + 1}`,
        passengerId: data.passengerId as string,
        seatNumber: data.seatNumber as number,
        departureStationId: data.departureStationId as string,
        arrivalStationId: data.arrivalStationId as string,
        travelDate: data.travelDate as Date,
        rideDepartureTime: data.rideDepartureTime as string,
        rideArrivalTime: data.rideArrivalTime as string,
        createdById: data.createdById as string,
        updatedById: data.updatedById as string
      };

      reservationStore.push(created);
      return created;
    });

    prismaMock.reservation.findFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      const byId = reservationStore.find(
        (item) => item.id === where.id && item.tenantId === where.tenantId
      );

      return byId ?? { ...baseReservation };
    });

    prismaMock.reservation.update.mockResolvedValue({
      ...baseReservation,
      status: ReservationStatus.CANCELLED,
      cancelledAt: new Date(),
      updatedById: 'admin-1'
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

  it('prevents cross-tenant reservation access', async () => {
    const response = await request(app.getHttpServer())
      .get('/reservations/reservation-1')
      .set('X-Tenant-Slug', 'other-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .expect(403);

    expect(response.body.message).toBe('Tenant mismatch between token and request context');
  });

  it('fails when seat already booked for overlapping segment', async () => {
    reservationStore.push({
      ...baseReservation,
      id: 'reservation-existing',
      seatNumber: 12,
      departureStationId: 'station-b',
      arrivalStationId: 'station-d'
    });

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

  it('rolls back entire batch when one booking fails', async () => {
    reservationStore.push({
      ...baseReservation,
      id: 'reservation-existing',
      seatNumber: 12,
      departureStationId: 'station-a',
      arrivalStationId: 'station-d'
    });

    const response = await request(app.getHttpServer())
      .post('/reservations/batch')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .send({
        items: [
          {
            rideId: 'ride-1',
            passengerId: 'passenger-1',
            travelDate: '2026-03-30',
            rideDepartureTime: '09:00',
            rideArrivalTime: '10:30',
            seatNumber: 13,
            departureStationId: 'station-a',
            arrivalStationId: 'station-c'
          },
          {
            rideId: 'ride-1',
            passengerId: 'passenger-1',
            travelDate: '2026-03-30',
            rideDepartureTime: '09:00',
            rideArrivalTime: '10:30',
            seatNumber: 12,
            departureStationId: 'station-a',
            arrivalStationId: 'station-c'
          }
        ]
      })
      .expect(409);

    expect(response.body.message).toBe('Seat is already booked for this route segment');
    expect(reservationStore).toHaveLength(1);
  });

  it('rejects booking when route segment capacity is exhausted', async () => {
    rideCapacity = 2;
    prismaMock.ride.findFirst.mockResolvedValueOnce({
      id: 'ride-1',
      capacity: 2,
      line: {
        departureStationId: 'station-a',
        arrivalStationId: 'station-d',
        intermediateStops: [
          { stationId: 'station-b', orderIndex: 1 },
          { stationId: 'station-c', orderIndex: 2 }
        ]
      }
    });

    reservationStore.push({
      ...baseReservation,
      id: 'reservation-existing',
      seatNumber: 1,
      departureStationId: 'station-a',
      arrivalStationId: 'station-d'
    });

    reservationStore.push({
      ...baseReservation,
      id: 'reservation-existing-2',
      seatNumber: 1,
      departureStationId: 'station-a',
      arrivalStationId: 'station-d'
    });

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
        seatNumber: 2,
        departureStationId: 'station-a',
        arrivalStationId: 'station-c'
      })
      .expect(409);

    expect(response.body.message).toBe('Ride capacity is exhausted for this route segment');
  });

  it('prevents duplicate same-seat booking during concurrent requests', async () => {
    const payload = {
      rideId: 'ride-1',
      passengerId: 'passenger-1',
      travelDate: '2026-03-30',
      rideDepartureTime: '09:00',
      rideArrivalTime: '10:30',
      seatNumber: 16,
      departureStationId: 'station-a',
      arrivalStationId: 'station-c'
    };

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/reservations')
        .set('X-Tenant-Slug', 'demo-tenant')
        .set('Authorization', 'Bearer access-token-admin')
        .send(payload),
      request(app.getHttpServer())
        .post('/reservations')
        .set('X-Tenant-Slug', 'demo-tenant')
        .set('Authorization', 'Bearer access-token-admin')
        .send(payload)
    ]);

    const statusCodes = [first.statusCode, second.statusCode].sort((a, b) => a - b);
    expect(statusCodes).toEqual([201, 409]);
  });
});
