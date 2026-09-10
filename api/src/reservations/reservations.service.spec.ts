import { BadRequestException, ConflictException } from '@nestjs/common';
import { ReservationStatus, UserRole } from '@prisma/client';
import { ReservationsService } from './reservations.service';

describe('ReservationsService', () => {
  let reservationStore: Array<{
    id: string;
    tenantId: string;
    rideId: string;
    passengerId: string;
    travelDate: Date;
    rideDepartureTime: string;
    rideArrivalTime: string;
    seatNumber: number;
    status: ReservationStatus;
    departureStationId: string;
    arrivalStationId: string;
  }>;

  let transactionQueue: Promise<void>;

  const prismaMock = {
    $transaction: jest.fn(),
    $executeRaw: jest.fn(),
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
        { stationId: 'station-b', orderIndex: 1, isBoarding: true, isDropoff: true },
        { stationId: 'station-c', orderIndex: 2, isBoarding: true, isDropoff: true }
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
    groupId: null,
    notes: null,
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
    reservationStore = [];
    transactionQueue = Promise.resolve();

    service = new ReservationsService(prismaMock as never);

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

    prismaMock.ride.findFirst.mockResolvedValue({ ...routeRide, capacity: 40 });
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

    prismaMock.reservation.findFirst.mockResolvedValue({ ...baseReservation });

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
        updatedById: data.updatedById as string,
        groupId: (data.groupId as string | null | undefined) ?? null,
        notes: (data.notes as string | null | undefined) ?? null
      };

      reservationStore.push({
        id: created.id,
        tenantId: created.tenantId,
        rideId: created.rideId,
        passengerId: created.passengerId,
        travelDate: created.travelDate,
        rideDepartureTime: created.rideDepartureTime,
        rideArrivalTime: created.rideArrivalTime,
        seatNumber: created.seatNumber,
        status: created.status,
        departureStationId: created.departureStationId,
        arrivalStationId: created.arrivalStationId
      });

      return created;
    });

    prismaMock.reservation.update.mockResolvedValue({
      ...baseReservation,
      status: ReservationStatus.CANCELLED,
      cancelledAt: new Date(),
      updatedById: 'manager-1'
    });
  });

  it('fails when seat is already booked on overlapping segment', async () => {
    reservationStore.push({
      id: 'reservation-existing',
      tenantId: 'tenant-1',
      rideId: 'ride-1',
      passengerId: 'passenger-1',
      travelDate: new Date('2026-03-30T00:00:00.000Z'),
      rideDepartureTime: '09:00',
      rideArrivalTime: '10:30',
      seatNumber: 12,
      status: ReservationStatus.ACTIVE,
      departureStationId: 'station-b',
      arrivalStationId: 'station-d'
    });

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

  it('rejects a departure station that is drop-off only', async () => {
    prismaMock.ride.findFirst.mockResolvedValueOnce({
      ...routeRide,
      capacity: 40,
      line: {
        ...routeRide.line,
        intermediateStops: [
          { stationId: 'station-b', orderIndex: 1, isBoarding: false, isDropoff: true },
          { stationId: 'station-c', orderIndex: 2, isBoarding: true, isDropoff: true }
        ]
      }
    });

    await expect(
      service.create(auth, {
        rideId: 'ride-1',
        passengerId: 'passenger-1',
        travelDate: '2026-03-30',
        rideDepartureTime: '09:00',
        rideArrivalTime: '10:30',
        seatNumber: 15,
        departureStationId: 'station-b',
        arrivalStationId: 'station-d'
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an arrival station that is boarding only', async () => {
    prismaMock.ride.findFirst.mockResolvedValueOnce({
      ...routeRide,
      capacity: 40,
      line: {
        ...routeRide.line,
        intermediateStops: [
          { stationId: 'station-b', orderIndex: 1, isBoarding: true, isDropoff: true },
          { stationId: 'station-c', orderIndex: 2, isBoarding: true, isDropoff: false }
        ]
      }
    });

    await expect(
      service.create(auth, {
        rideId: 'ride-1',
        passengerId: 'passenger-1',
        travelDate: '2026-03-30',
        rideDepartureTime: '09:00',
        rideArrivalTime: '10:30',
        seatNumber: 15,
        departureStationId: 'station-a',
        arrivalStationId: 'station-c'
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows the line endpoints regardless of intermediate boarding rules', async () => {
    const result = await service.create(auth, {
      rideId: 'ride-1',
      passengerId: 'passenger-1',
      travelDate: '2026-03-30',
      rideDepartureTime: '09:00',
      rideArrivalTime: '10:30',
      seatNumber: 21,
      departureStationId: 'station-a',
      arrivalStationId: 'station-d'
    });

    expect(result.departureStationId).toBe('station-a');
    expect(result.arrivalStationId).toBe('station-d');
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

  it('fails the whole batch and rolls back when one item fails', async () => {
    reservationStore.push({
      id: 'reservation-existing',
      tenantId: 'tenant-1',
      rideId: 'ride-1',
      passengerId: 'passenger-1',
      travelDate: new Date('2026-03-30T00:00:00.000Z'),
      rideDepartureTime: '09:00',
      rideArrivalTime: '10:30',
      seatNumber: 5,
      status: ReservationStatus.ACTIVE,
      departureStationId: 'station-a',
      arrivalStationId: 'station-d'
    });

    await expect(
      service.createBatch(auth, {
        items: [
          {
            rideId: 'ride-1',
            passengerId: 'passenger-1',
            travelDate: '2026-03-30',
            rideDepartureTime: '09:00',
            rideArrivalTime: '10:30',
            seatNumber: 6,
            departureStationId: 'station-a',
            arrivalStationId: 'station-c'
          },
          {
            rideId: 'ride-1',
            passengerId: 'passenger-1',
            travelDate: '2026-03-30',
            rideDepartureTime: '09:00',
            rideArrivalTime: '10:30',
            seatNumber: 5,
            departureStationId: 'station-a',
            arrivalStationId: 'station-c'
          }
        ]
      })
    ).rejects.toBeInstanceOf(ConflictException);

    expect(reservationStore).toHaveLength(1);
  });

  it('stamps the same groupId on all items when travelTogether is true and items.length > 1', async () => {
    const result = await service.createBatch(auth, {
      travelTogether: true,
      items: [
        {
          rideId: 'ride-1',
          passengerId: 'passenger-1',
          travelDate: '2026-03-30',
          rideDepartureTime: '09:00',
          rideArrivalTime: '10:30',
          seatNumber: 1,
          departureStationId: 'station-a',
          arrivalStationId: 'station-c'
        },
        {
          rideId: 'ride-1',
          passengerId: 'passenger-1',
          travelDate: '2026-03-30',
          rideDepartureTime: '09:00',
          rideArrivalTime: '10:30',
          seatNumber: 2,
          departureStationId: 'station-a',
          arrivalStationId: 'station-c'
        },
        {
          rideId: 'ride-1',
          passengerId: 'passenger-1',
          travelDate: '2026-03-30',
          rideDepartureTime: '09:00',
          rideArrivalTime: '10:30',
          seatNumber: 3,
          departureStationId: 'station-a',
          arrivalStationId: 'station-c'
        }
      ]
    });

    const groupIds = result.items.map((item) => item.reservation?.groupId);
    expect(groupIds.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
    expect(new Set(groupIds).size).toBe(1);
  });

  it('leaves groupId null when travelTogether is false', async () => {
    const result = await service.createBatch(auth, {
      travelTogether: false,
      items: [
        {
          rideId: 'ride-1',
          passengerId: 'passenger-1',
          travelDate: '2026-03-30',
          rideDepartureTime: '09:00',
          rideArrivalTime: '10:30',
          seatNumber: 7,
          departureStationId: 'station-a',
          arrivalStationId: 'station-c'
        },
        {
          rideId: 'ride-1',
          passengerId: 'passenger-1',
          travelDate: '2026-03-30',
          rideDepartureTime: '09:00',
          rideArrivalTime: '10:30',
          seatNumber: 8,
          departureStationId: 'station-a',
          arrivalStationId: 'station-c'
        }
      ]
    });

    expect(result.items.every((item) => item.reservation?.groupId === null)).toBe(true);
  });

  it('leaves groupId null when travelTogether is true but only one item is supplied', async () => {
    const result = await service.createBatch(auth, {
      travelTogether: true,
      items: [
        {
          rideId: 'ride-1',
          passengerId: 'passenger-1',
          travelDate: '2026-03-30',
          rideDepartureTime: '09:00',
          rideArrivalTime: '10:30',
          seatNumber: 9,
          departureStationId: 'station-a',
          arrivalStationId: 'station-c'
        }
      ]
    });

    expect(result.items[0].reservation?.groupId).toBeNull();
  });

  it('fails when route segment capacity is exhausted', async () => {
    prismaMock.ride.findFirst.mockResolvedValueOnce({ ...routeRide, capacity: 1 });

    reservationStore.push({
      id: 'reservation-existing',
      tenantId: 'tenant-1',
      rideId: 'ride-1',
      passengerId: 'passenger-1',
      travelDate: new Date('2026-03-30T00:00:00.000Z'),
      rideDepartureTime: '09:00',
      rideArrivalTime: '10:30',
      seatNumber: 1,
      status: ReservationStatus.ACTIVE,
      departureStationId: 'station-a',
      arrivalStationId: 'station-d'
    });

    await expect(
      service.create(auth, {
        rideId: 'ride-1',
        passengerId: 'passenger-1',
        travelDate: '2026-03-30',
        rideDepartureTime: '09:00',
        rideArrivalTime: '10:30',
        seatNumber: 1,
        departureStationId: 'station-a',
        arrivalStationId: 'station-c'
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('prevents duplicate same-seat bookings in concurrent requests', async () => {
    const requestPayload = {
      rideId: 'ride-1',
      passengerId: 'passenger-1',
      travelDate: '2026-03-30',
      rideDepartureTime: '09:00',
      rideArrivalTime: '10:30',
      seatNumber: 11,
      departureStationId: 'station-a',
      arrivalStationId: 'station-c'
    };

    const [first, second] = await Promise.allSettled([
      service.create(auth, requestPayload),
      service.create(auth, requestPayload)
    ]);

    const fulfilledCount = [first, second].filter((item) => item.status === 'fulfilled').length;
    const rejectedCount = [first, second].filter((item) => item.status === 'rejected').length;

    expect(fulfilledCount).toBe(1);
    expect(rejectedCount).toBe(1);
  });
});
