import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ReservationStatus, RideExceptionType, RideStatus, RideType, UserRole } from '@prisma/client';
import { RidesService } from './rides.service';

describe('RidesService', () => {
  const prismaMock = {
    $transaction: jest.fn(),
    line: {
      findFirst: jest.fn()
    },
    reservation: {
      groupBy: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn()
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
    }
  };

  const auth = {
    sub: 'admin-1',
    tenantId: 'tenant-1',
    role: UserRole.ADMIN,
    username: 'demo-admin'
  };

  let service: RidesService;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.reservation.groupBy.mockResolvedValue([]);
    service = new RidesService(prismaMock as never);
  });

  it('requires day-times for recurring rides', async () => {
    prismaMock.line.findFirst.mockResolvedValue({ id: 'line-1', name: 'Central - North', departureStationId: 'station-a', arrivalStationId: 'station-b',
        intermediateStops: [] });

    await expect(
      service.create(auth, {
        lineId: 'line-1',
        name: 'Recurring Ride',
        capacity: 38,
        type: RideType.RECURRING,
        recurringStartDate: '2026-03-20',
        daySchedules: []
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows overnight day-times for recurring rides', () => {
    const validator = service as unknown as {
      validateDaySchedules: (daySchedules: Array<{ dayOfWeek: number; stationTimes: Array<{ stationId: string; orderIndex: number; time?: string }> }>, routeStationIds: string[]) => void;
    };

    expect(() =>
      validator.validateDaySchedules([{ dayOfWeek: 1, stationTimes: [{ stationId: 'station-a', orderIndex: 0, time: '12:00' }, { stationId: 'station-b', orderIndex: 1, time: '00:00' }] }], ['station-a','station-b'])
    ).not.toThrow();
  });

  it('requires date and times for one-time rides', async () => {
    prismaMock.line.findFirst.mockResolvedValue({ id: 'line-1', name: 'Central - North', departureStationId: 'station-a', arrivalStationId: 'station-b',
        intermediateStops: [] });

    await expect(
      service.create(auth, {
        lineId: 'line-1',
        name: 'One Time Ride',
        capacity: 38,
        type: RideType.ONE_TIME,
        oneTimeDate: '2026-03-21'
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects zero-duration one-time rides', async () => {
    prismaMock.line.findFirst.mockResolvedValue({ id: 'line-1', name: 'Central - North', departureStationId: 'station-a', arrivalStationId: 'station-b',
        intermediateStops: [] });

    await expect(
      service.create(auth, {
        lineId: 'line-1',
        name: 'Invalid Equal Time Ride',
        capacity: 38,
        type: RideType.ONE_TIME,
        oneTimeDate: '2026-03-21',
        oneTimeDepartureTime: '10:00',
        oneTimeArrivalTime: '10:00'
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid status transitions', async () => {
    prismaMock.ride.findFirst.mockResolvedValue({
      id: 'ride-1',
      tenantId: 'tenant-1',
      lineId: 'line-1',
      createdById: 'admin-1',
      updatedById: 'admin-1',
      name: 'Ride',
      capacity: 38,
      type: RideType.RECURRING,
      status: RideStatus.ACTIVE,
      recurringStartDate: new Date('2026-03-20T00:00:00.000Z'),
      recurringEndDate: null,
      oneTimeDate: null,
      oneTimeDepartureTime: null,
      oneTimeArrivalTime: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      line: {
        id: 'line-1',
        name: 'Line 1',
        departureStationId: 'station-a',
        arrivalStationId: 'station-b',
        intermediateStops: []
      },
      daySchedules: [{ dayOfWeek: 1, stationTimes: [{ stationId: 'station-a', orderIndex: 0, time: '09:00' }, { stationId: 'station-b', orderIndex: 1, time: '10:30' }] }],
      exceptions: []
    });

    await expect(
      service.update(auth, 'ride-1', {
        status: RideStatus.DRAFT
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  describe('lowering capacity under a sold seat', () => {
    // Seats 31 to 38 are sold on a 38-seat bus; the agency is typing 30.
    const rideOnSale = {
      id: 'ride-1',
      tenantId: 'tenant-1',
      lineId: 'line-1',
      createdById: 'admin-1',
      updatedById: 'admin-1',
      name: 'Ride',
      capacity: 38,
      type: RideType.RECURRING,
      status: RideStatus.ACTIVE,
      recurringStartDate: new Date('2026-03-20T00:00:00.000Z'),
      recurringEndDate: null,
      oneTimeDate: null,
      oneTimeDepartureTime: null,
      oneTimeArrivalTime: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      line: {
        id: 'line-1',
        name: 'Line 1',
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
    };

    beforeEach(() => {
      prismaMock.ride.findFirst.mockResolvedValue(rideOnSale);
      prismaMock.$transaction.mockImplementation(async (fn: never) =>
        (fn as unknown as (tx: unknown) => Promise<unknown>)({
          ride: {
            update: jest.fn(),
            findFirst: jest.fn().mockResolvedValue({ ...rideOnSale, capacity: 30 })
          },
          rideDaySchedule: { create: jest.fn(), deleteMany: jest.fn() }
        })
      );
    });

    it('refuses, naming how many passengers it would strand', async () => {
      prismaMock.reservation.count.mockResolvedValue(8);
      prismaMock.reservation.findFirst.mockResolvedValue({ seatNumber: 38 });

      await expect(service.update(auth, 'ride-1', { capacity: 30 })).rejects.toMatchObject({
        response: {
          code: 'WOULD_BREAK_RESERVATIONS',
          invariant: 'reservation.seatWithinCapacity',
          affectedCount: 8,
          highestOccupiedSeat: 38
        }
      });
    });

    it('goes through once the caller confirms it in the body', async () => {
      prismaMock.reservation.count.mockResolvedValue(8);
      prismaMock.reservation.findFirst.mockResolvedValue({ seatNumber: 38 });

      await expect(
        service.update(auth, 'ride-1', { capacity: 30, confirmBreakingChange: true })
      ).resolves.toMatchObject({ capacity: 30 });
    });

    it('asks nothing when every sold seat still fits', async () => {
      prismaMock.reservation.count.mockResolvedValue(0);
      prismaMock.reservation.findFirst.mockResolvedValue(null);

      await expect(service.update(auth, 'ride-1', { capacity: 30 })).resolves.toMatchObject({
        capacity: 30
      });
    });

    it('leaves raising capacity alone', async () => {
      await expect(
        service.update(auth, 'ride-1', { capacity: 48 })
      ).resolves.toBeDefined();

      expect(prismaMock.reservation.count).not.toHaveBeenCalled();
    });
  });

  it('rejects mixed skip and additional exceptions for same date', async () => {
    prismaMock.ride.findFirst.mockResolvedValue({
      id: 'ride-1',
      tenantId: 'tenant-1',
      lineId: 'line-1',
      createdById: 'admin-1',
      updatedById: 'admin-1',
      name: 'Ride',
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
        name: 'Line 1',
        departureStationId: 'station-a',
        arrivalStationId: 'station-b',
        intermediateStops: []
      },
      daySchedules: [{ dayOfWeek: 1, stationTimes: [{ stationId: 'station-a', orderIndex: 0, time: '09:00' }, { stationId: 'station-b', orderIndex: 1, time: '10:30' }] }],
      exceptions: []
    });

    prismaMock.rideException.findMany.mockResolvedValue([
      {
        id: 'ex-1',
        type: RideExceptionType.SKIP,
        departureTime: null,
        arrivalTime: null
      }
    ]);

    await expect(
      service.addException(auth, 'ride-1', {
        date: '2026-03-25',
        type: RideExceptionType.ADDITIONAL,
        departureTime: '11:00',
        arrivalTime: '12:00'
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws not found when ride is out of tenant scope', async () => {
    prismaMock.ride.findFirst.mockResolvedValue(null);

    await expect(service.getById(auth, 'ride-missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('materializes recurring instances using timezone offset day boundary', async () => {
    prismaMock.ride.findMany.mockResolvedValue([
      {
        id: 'ride-1',
        tenantId: 'tenant-1',
        lineId: 'line-1',
        name: 'Boundary Ride',
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
          name: 'Line 1',
          departureStationId: 'station-a',
          arrivalStationId: 'station-b',
        intermediateStops: []
        },
        daySchedules: [{ dayOfWeek: 1, stationTimes: [{ stationId: 'station-a', orderIndex: 0, time: '09:00' }, { stationId: 'station-b', orderIndex: 1, time: '10:30' }] }],
        exceptions: []
      }
    ]);

    const result = await service.listInstancesByDate(auth, {
      date: '2026-03-30',
      timezoneOffsetMinutes: -300
    });

    expect(result.date).toBe('2026-03-30');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].source).toBe('BASE');
    expect(result.items[0].departureTime).toBe('09:00');
  });

  it('removes base instance when skip exception exists on date', async () => {
    prismaMock.ride.findMany.mockResolvedValue([
      {
        id: 'ride-1',
        tenantId: 'tenant-1',
        lineId: 'line-1',
        name: 'Skip Ride',
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
          name: 'Line 1',
          departureStationId: 'station-a',
          arrivalStationId: 'station-b',
        intermediateStops: []
        },
        daySchedules: [{ dayOfWeek: 1, stationTimes: [{ stationId: 'station-a', orderIndex: 0, time: '09:00' }, { stationId: 'station-b', orderIndex: 1, time: '10:30' }] }],
        exceptions: [
          {
            exceptionDate: new Date('2026-03-30T00:00:00.000Z'),
            type: RideExceptionType.SKIP,
            departureTime: null,
            arrivalTime: null
          }
        ]
      }
    ]);

    const result = await service.listInstancesByDate(auth, {
      date: '2026-03-30'
    });

    expect(result.items).toHaveLength(0);
  });

  it('creates instance from additional exception when base does not exist', async () => {
    prismaMock.ride.findMany.mockResolvedValue([
      {
        id: 'ride-1',
        tenantId: 'tenant-1',
        lineId: 'line-1',
        name: 'Additional Ride',
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
          name: 'Line 1',
          departureStationId: 'station-a',
          arrivalStationId: 'station-b',
        intermediateStops: []
        },
        daySchedules: [{ dayOfWeek: 2, stationTimes: [{ stationId: 'station-a', orderIndex: 0, time: '09:00' }, { stationId: 'station-b', orderIndex: 1, time: '10:30' }] }],
        exceptions: [
          {
            exceptionDate: new Date('2026-03-30T00:00:00.000Z'),
            type: RideExceptionType.ADDITIONAL,
            departureTime: '13:00',
            arrivalTime: '14:10'
          }
        ]
      }
    ]);

    const result = await service.listInstancesByDate(auth, {
      date: '2026-03-30'
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].source).toBe('ADDITIONAL');
    expect(result.items[0].departureTime).toBe('13:00');
    expect(result.items[0].reservationCount).toBe(0);
    expect(result.items[0].availability.availableSeats).toBe(38);
  });

  it('computes availability from active reservations for matching ride instance', async () => {
    prismaMock.ride.findMany.mockResolvedValue([
      {
        id: 'ride-1',
        tenantId: 'tenant-1',
        lineId: 'line-1',
        name: 'Reserved Ride',
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
          name: 'Line 1',
          departureStationId: 'station-a',
          arrivalStationId: 'station-b',
        intermediateStops: []
        },
        daySchedules: [{ dayOfWeek: 1, stationTimes: [{ stationId: 'station-a', orderIndex: 0, time: '09:00' }, { stationId: 'station-b', orderIndex: 1, time: '10:30' }] }],
        exceptions: []
      }
    ]);

    prismaMock.reservation.groupBy.mockResolvedValue([
      {
        rideId: 'ride-1',
        rideDepartureTime: '09:00',
        _count: { _all: 2 }
      }
    ]);

    const result = await service.listInstancesByDate(auth, {
      date: '2026-03-30'
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].reservationCount).toBe(2);
    expect(result.items[0].availability.reservedSeats).toBe(2);
    expect(result.items[0].availability.availableSeats).toBe(36);
    expect(prismaMock.reservation.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['rideId', 'rideDepartureTime'],
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          travelDate: new Date('2026-03-30T00:00:00.000Z')
        })
      })
    );
  });

  it('prevents deleting a ride with active reservations when cascade is disabled', async () => {
    prismaMock.ride.findFirst.mockResolvedValue({
      id: 'ride-1',
      tenantId: 'tenant-1',
      lineId: 'line-1',
      createdById: 'admin-1',
      updatedById: 'admin-1',
      name: 'Ride',
      capacity: 38,
      type: RideType.RECURRING,
      status: RideStatus.ACTIVE,
      recurringStartDate: new Date('2026-03-20T00:00:00.000Z'),
      recurringEndDate: null,
      oneTimeDate: null,
      oneTimeDepartureTime: null,
      oneTimeArrivalTime: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      line: {
        id: 'line-1',
        name: 'Line 1',
        departureStationId: 'station-a',
        arrivalStationId: 'station-b',
        intermediateStops: []
      },
      daySchedules: [{ dayOfWeek: 1, stationTimes: [{ stationId: 'station-a', orderIndex: 0, time: '09:00' }, { stationId: 'station-b', orderIndex: 1, time: '10:30' }] }],
      exceptions: []
    });
    prismaMock.reservation.count.mockResolvedValue(1);

    await expect(service.remove(auth, 'ride-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prismaMock.ride.delete).not.toHaveBeenCalled();
  });

  it('soft deletes ride when no active reservations exist', async () => {
    prismaMock.ride.findFirst.mockResolvedValue({
      id: 'ride-1',
      tenantId: 'tenant-1',
      lineId: 'line-1',
      createdById: 'admin-1',
      updatedById: 'admin-1',
      name: 'Ride',
      capacity: 38,
      type: RideType.RECURRING,
      status: RideStatus.ACTIVE,
      recurringStartDate: new Date('2026-03-20T00:00:00.000Z'),
      recurringEndDate: null,
      oneTimeDate: null,
      oneTimeDepartureTime: null,
      oneTimeArrivalTime: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      line: {
        id: 'line-1',
        name: 'Line 1',
        departureStationId: 'station-a',
        arrivalStationId: 'station-b',
        intermediateStops: []
      },
      daySchedules: [{ dayOfWeek: 1, stationTimes: [{ stationId: 'station-a', orderIndex: 0, time: '09:00' }, { stationId: 'station-b', orderIndex: 1, time: '10:30' }] }],
      exceptions: []
    });
    prismaMock.reservation.count.mockResolvedValue(0);
    prismaMock.ride.update.mockResolvedValue({
      id: 'ride-1',
      tenantId: 'tenant-1',
      lineId: 'line-1',
      createdById: 'admin-1',
      updatedById: 'admin-1',
      name: 'Ride',
      capacity: 38,
      type: RideType.RECURRING,
      status: RideStatus.INACTIVE,
      recurringStartDate: new Date('2026-03-20T00:00:00.000Z'),
      recurringEndDate: null,
      oneTimeDate: null,
      oneTimeDepartureTime: null,
      oneTimeArrivalTime: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      line: {
        id: 'line-1',
        name: 'Line 1',
        departureStationId: 'station-a',
        arrivalStationId: 'station-b',
        intermediateStops: []
      },
      daySchedules: [{ dayOfWeek: 1, stationTimes: [{ stationId: 'station-a', orderIndex: 0, time: '09:00' }, { stationId: 'station-b', orderIndex: 1, time: '10:30' }] }],
      exceptions: []
    });

    const result = await service.remove(auth, 'ride-1');

    expect(prismaMock.ride.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ride-1' },
        data: expect.objectContaining({
          status: RideStatus.INACTIVE,
          updatedById: 'admin-1'
        })
      })
    );
    expect(result.status).toBe(RideStatus.INACTIVE);
  });

  it('cascade cancels reservations and soft deletes ride', async () => {
    prismaMock.ride.findFirst.mockResolvedValue({
      id: 'ride-1',
      tenantId: 'tenant-1',
      lineId: 'line-1',
      createdById: 'admin-1',
      updatedById: 'admin-1',
      name: 'Ride',
      capacity: 38,
      type: RideType.RECURRING,
      status: RideStatus.ACTIVE,
      recurringStartDate: new Date('2026-03-20T00:00:00.000Z'),
      recurringEndDate: null,
      oneTimeDate: null,
      oneTimeDepartureTime: null,
      oneTimeArrivalTime: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      line: {
        id: 'line-1',
        name: 'Line 1',
        departureStationId: 'station-a',
        arrivalStationId: 'station-b',
        intermediateStops: []
      },
      daySchedules: [{ dayOfWeek: 1, stationTimes: [{ stationId: 'station-a', orderIndex: 0, time: '09:00' }, { stationId: 'station-b', orderIndex: 1, time: '10:30' }] }],
      exceptions: []
    });

    const tx = {
      reservation: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 })
      },
      ride: {
        update: jest.fn().mockResolvedValue({
          id: 'ride-1',
          tenantId: 'tenant-1',
          lineId: 'line-1',
          createdById: 'admin-1',
          updatedById: 'admin-1',
          name: 'Ride',
          capacity: 38,
          type: RideType.RECURRING,
          status: RideStatus.INACTIVE,
          recurringStartDate: new Date('2026-03-20T00:00:00.000Z'),
          recurringEndDate: null,
          oneTimeDate: null,
          oneTimeDepartureTime: null,
          oneTimeArrivalTime: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          line: {
            id: 'line-1',
            name: 'Line 1',
            departureStationId: 'station-a',
            arrivalStationId: 'station-b',
        intermediateStops: []
          },
          daySchedules: [{ dayOfWeek: 1, stationTimes: [{ stationId: 'station-a', orderIndex: 0, time: '09:00' }, { stationId: 'station-b', orderIndex: 1, time: '10:30' }] }],
          exceptions: []
        })
      }
    };

    prismaMock.$transaction.mockImplementation(async (callback: (db: typeof tx) => unknown) => callback(tx));

    const result = await service.remove(auth, 'ride-1', true);

    expect(tx.reservation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          rideId: 'ride-1',
          status: ReservationStatus.ACTIVE
        }),
        data: expect.objectContaining({
          status: ReservationStatus.CANCELLED,
          updatedById: 'admin-1'
        })
      })
    );
    expect(result.status).toBe(RideStatus.INACTIVE);
  });
});
