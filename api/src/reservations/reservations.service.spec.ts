import { BadRequestException, ConflictException } from '@nestjs/common';
import { ReservationStatus, UserRole } from '@prisma/client';
import { ReservationsService } from './reservations.service';

describe('ReservationsService', () => {
  const prismaMock = {
    $transaction: jest.fn(),
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

  const auth = {
    sub: 'admin-1',
    tenantId: 'tenant-1',
    role: UserRole.ADMIN,
    username: 'demo-admin'
  };

  const routeRide = {
    id: 'ride-1',
    line: {
      departureStationId: 'station-a',
      arrivalStationId: 'station-d',
      intermediateStops: [
        { stationId: 'station-b', orderIndex: 1 },
        { stationId: 'station-c', orderIndex: 2 }
      ]
    }
  };

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
      name: 'Central'
    },
    arrivalStation: {
      id: 'station-c',
      name: 'Midway'
    }
  };

  let service: ReservationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReservationsService(prismaMock as never);

    prismaMock.ride.findFirst.mockResolvedValue(routeRide);
    prismaMock.passenger.findFirst.mockResolvedValue({ id: 'passenger-1' });
    prismaMock.reservation.findMany.mockResolvedValue([]);
    prismaMock.reservation.findFirst.mockResolvedValue({ ...baseReservation });

    prismaMock.reservation.create.mockResolvedValue({ ...baseReservation });
    prismaMock.reservation.update.mockResolvedValue({
      ...baseReservation,
      status: ReservationStatus.CANCELLED,
      cancelledAt: new Date(),
      updatedById: 'manager-1'
    });
  });

  it('fails when seat is already booked on overlapping segment', async () => {
    prismaMock.reservation.findMany.mockResolvedValueOnce([
      {
        id: 'reservation-existing',
        departureStationId: 'station-b',
        arrivalStationId: 'station-d'
      }
    ]);

    await expect(
      service.create(auth, {
        rideId: 'ride-1',
        passengerId: 'passenger-1',
        travelDate: '2026-03-30',
        rideDepartureTime: '09:00',
        rideArrivalTime: '10:30',
        seatNumber: 12,
        departureStationId: 'station-a',
        arrivalStationId: 'station-c'
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('fails when departure or arrival is not valid for line path', async () => {
    await expect(
      service.create(auth, {
        rideId: 'ride-1',
        passengerId: 'passenger-1',
        travelDate: '2026-03-30',
        rideDepartureTime: '09:00',
        rideArrivalTime: '10:30',
        seatNumber: 15,
        departureStationId: 'station-z',
        arrivalStationId: 'station-c'
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates status and audit fields on cancellation', async () => {
    const result = await service.cancel(auth, 'reservation-1');

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
    expect(result.status).toBe(ReservationStatus.CANCELLED);
  });
});
