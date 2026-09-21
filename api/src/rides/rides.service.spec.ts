import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  ReservationStatus,
  RideExceptionType,
  RideStatus,
  RideType,
  UserRole
} from '@prisma/client';
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
      findMany: jest.fn(),
      updateMany: jest.fn()
    },
    station: {
      findMany: jest.fn()
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
    // Nothing sold and nothing to name: the prospective checks find an empty
    // window and report no violations, which is what every test that is not
    // about them wants.
    prismaMock.reservation.findMany.mockResolvedValue([]);
    prismaMock.ride.findMany.mockResolvedValue([]);
    prismaMock.station.findMany.mockResolvedValue([]);
    // The guarded writes read what they are about to write inside their own
    // transaction, so the callback form has to be handed a client. Tests that
    // need the guard's two passes to see different states replace this.
    prismaMock.$transaction.mockImplementation(async (arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: typeof prismaMock) => unknown)(prismaMock)
        : undefined
    );
    service = new RidesService(prismaMock as never);
  });

  it('requires day-times for recurring rides', async () => {
    prismaMock.line.findFirst.mockResolvedValue({
      id: 'line-1',
      name: 'Central - North',
      departureStationId: 'station-a',
      arrivalStationId: 'station-b',
      intermediateStops: []
    });

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
      validateDaySchedules: (
        daySchedules: Array<{
          dayOfWeek: number;
          stationTimes: Array<{ stationId: string; orderIndex: number; time?: string }>;
        }>,
        routeStationIds: string[]
      ) => void;
    };

    expect(() =>
      validator.validateDaySchedules(
        [
          {
            dayOfWeek: 1,
            stationTimes: [
              { stationId: 'station-a', orderIndex: 0, time: '12:00' },
              { stationId: 'station-b', orderIndex: 1, time: '00:00' }
            ]
          }
        ],
        ['station-a', 'station-b']
      )
    ).not.toThrow();
  });

  it('requires date and times for one-time rides', async () => {
    prismaMock.line.findFirst.mockResolvedValue({
      id: 'line-1',
      name: 'Central - North',
      departureStationId: 'station-a',
      arrivalStationId: 'station-b',
      intermediateStops: []
    });

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
    prismaMock.line.findFirst.mockResolvedValue({
      id: 'line-1',
      name: 'Central - North',
      departureStationId: 'station-a',
      arrivalStationId: 'station-b',
      intermediateStops: []
    });

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
    });

    await expect(
      service.update(auth, 'ride-1', {
        status: RideStatus.DRAFT
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // The merge below fills every field the DTO omits from the stored ride and
  // writes the result back. Read outside the transaction that writes it, a
  // concurrent edit landing in between is overwritten with values read before
  // it existed, and nothing records that it happened.
  it('reads the ride it merges inside the transaction that writes it', async () => {
    const stored = {
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

    const readInTransaction = jest.fn().mockResolvedValue(stored);

    prismaMock.$transaction.mockImplementation(async (fn: never) =>
      (fn as unknown as (tx: unknown) => Promise<unknown>)({
        ...prismaMock,
        ride: { ...prismaMock.ride, findFirst: readInTransaction }
      })
    );

    await service.update(auth, 'ride-1', { capacity: 40 });

    expect(readInTransaction).toHaveBeenCalled();
    expect(prismaMock.ride.findFirst).not.toHaveBeenCalled();
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

    // Far enough out that the 30-day reporting window would miss it: a write
    // is judged on everything it breaks, not on the month a report covers.
    const travelDate = (() => {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() + 120);
      date.setUTCHours(0, 0, 0, 0);
      return date;
    })();

    const soldSeat = {
      id: 'reservation-1',
      rideId: 'ride-1',
      travelDate,
      rideDepartureTime: '09:00',
      rideArrivalTime: '10:30',
      seatNumber: 38,
      departureStationId: 'station-a',
      arrivalStationId: 'station-b',
      passenger: {
        id: 'passenger-1',
        firstName: 'Marko',
        lastName: 'Markovic',
        phone: '+381601234567',
        isActive: true
      }
    };

    const windowedRide = (capacity: number) => ({
      id: 'ride-1',
      name: 'Morning Central Route',
      capacity,
      status: 'ACTIVE',
      type: 'RECURRING',
      recurringStartDate: new Date('2020-01-01T00:00:00.000Z'),
      recurringEndDate: null,
      oneTimeDate: null,
      oneTimeDepartureTime: null,
      oneTimeArrivalTime: null,
      line: {
        name: 'Central - North',
        isActive: true,
        departureStationId: 'station-a',
        arrivalStationId: 'station-b',
        intermediateStops: []
      },
      daySchedules: [
        {
          dayOfWeek: travelDate.getUTCDay(),
          stationTimes: [
            { orderIndex: 0, time: '09:00' },
            { orderIndex: 1, time: '10:30' }
          ]
        }
      ],
      exceptions: []
    });

    /**
     * A transaction that answers the guard's two passes differently, which is
     * what the database does for real: the first sees the ride as it stands,
     * the second sees the capacity the write just applied.
     */
    const transactionSeeing = (reservations: unknown[], capacityAfterWrite: number) => {
      let written = false;

      return {
        reservation: { findMany: jest.fn().mockResolvedValue(reservations) },
        station: { findMany: jest.fn().mockResolvedValue([]) },
        ride: {
          findMany: jest.fn(async () => [windowedRide(written ? capacityAfterWrite : 48)]),
          update: jest.fn(async () => {
            written = true;
          }),
          findFirst: jest.fn().mockResolvedValue({ ...rideOnSale, capacity: capacityAfterWrite })
        },
        rideDaySchedule: { create: jest.fn(), deleteMany: jest.fn() }
      };
    };

    const runUpdateAgainst = (reservations: unknown[], capacityAfterWrite: number) => {
      prismaMock.$transaction.mockImplementation(async (fn: never) =>
        (fn as unknown as (tx: unknown) => Promise<unknown>)(
          transactionSeeing(reservations, capacityAfterWrite)
        )
      );
    };

    beforeEach(() => {
      prismaMock.ride.findFirst.mockResolvedValue(rideOnSale);
      runUpdateAgainst([], 30);
    });

    it('refuses, naming how many passengers it would strand', async () => {
      runUpdateAgainst([soldSeat], 30);

      await expect(service.update(auth, 'ride-1', { capacity: 30 })).rejects.toMatchObject({
        response: {
          code: 'WOULD_BREAK_RESERVATIONS',
          invariant: 'reservation.seatWithinCapacity',
          affectedCount: 1,
          message: 'Ova izmena ostavlja 1 rezervaciju sa sedistem koje ne postoji.'
        }
      });
    });

    it('goes through once the caller confirms it in the body', async () => {
      runUpdateAgainst([soldSeat], 30);

      await expect(
        service.update(auth, 'ride-1', { capacity: 30, confirmBreakingChange: true })
      ).resolves.toMatchObject({ capacity: 30 });
    });

    it('asks nothing when every sold seat still fits', async () => {
      runUpdateAgainst([{ ...soldSeat, seatNumber: 12 }], 30);

      await expect(service.update(auth, 'ride-1', { capacity: 30 })).resolves.toMatchObject({
        capacity: 30
      });
    });

    it('leaves raising capacity alone', async () => {
      runUpdateAgainst([soldSeat], 48);

      await expect(service.update(auth, 'ride-1', { capacity: 48 })).resolves.toBeDefined();
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
    });

    prismaMock.rideException.findMany.mockResolvedValue([
      {
        id: 'ex-1',
        type: RideExceptionType.SKIP,
        departureTime: null,
        arrivalTime: null
      }
    ]);
    prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({ rideException: prismaMock.rideException })
    );

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
        daySchedules: [
          {
            dayOfWeek: 1,
            stationTimes: [
              { stationId: 'station-a', orderIndex: 0, time: '09:00' },
              { stationId: 'station-b', orderIndex: 1, time: '10:30' }
            ]
          }
        ],
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
        daySchedules: [
          {
            dayOfWeek: 2,
            stationTimes: [
              { stationId: 'station-a', orderIndex: 0, time: '09:00' },
              { stationId: 'station-b', orderIndex: 1, time: '10:30' }
            ]
          }
        ],
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
        })
      }
    };

    prismaMock.$transaction.mockImplementation(async (callback: (db: typeof tx) => unknown) =>
      callback(tx)
    );

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

  // The agency moves the morning departure an hour later. The reservations
  // sold on the old time stop matching any departure and vanish from every
  // list while still holding their seats — which is the one breakage the
  // registry has a repair for, so the refusal can offer to fix it rather than
  // only to be overridden.
  describe('moving the departure time under a sold reservation', () => {
    const travelDate = (() => {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() + 60);
      date.setUTCHours(0, 0, 0, 0);
      return date;
    })();

    const dayOfWeek = travelDate.getUTCDay();

    const timesAt = (departure: string, arrival: string) => [
      { stationId: 'station-a', orderIndex: 0, time: departure },
      { stationId: 'station-b', orderIndex: 1, time: arrival }
    ];

    const storedRide = (departure: string, arrival: string) => ({
      id: 'ride-1',
      tenantId: 'tenant-1',
      lineId: 'line-1',
      createdById: 'admin-1',
      updatedById: 'admin-1',
      name: 'Ride',
      capacity: 38,
      type: RideType.RECURRING,
      status: RideStatus.ACTIVE,
      recurringStartDate: new Date('2020-01-01T00:00:00.000Z'),
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
      daySchedules: [{ dayOfWeek, stationTimes: timesAt(departure, arrival) }],
      exceptions: []
    });

    const windowedRide = (departure: string, arrival: string) => ({
      id: 'ride-1',
      name: 'Ride',
      capacity: 38,
      status: 'ACTIVE',
      type: 'RECURRING',
      recurringStartDate: new Date('2020-01-01T00:00:00.000Z'),
      recurringEndDate: null,
      oneTimeDate: null,
      oneTimeDepartureTime: null,
      oneTimeArrivalTime: null,
      line: {
        name: 'Line 1',
        isActive: true,
        departureStationId: 'station-a',
        arrivalStationId: 'station-b',
        intermediateStops: []
      },
      daySchedules: [
        {
          dayOfWeek,
          stationTimes: [
            { orderIndex: 0, time: departure },
            { orderIndex: 1, time: arrival }
          ]
        }
      ],
      exceptions: []
    });

    /**
     * A transaction that moves with the write, and with the repair: the scans
     * after the write see the later departure, and a reservation the repair
     * updates reads back updated on the scan that follows.
     */
    const transactionMoving = () => {
      let written = false;

      const reservations = [
        {
          id: 'reservation-1',
          rideId: 'ride-1',
          travelDate,
          rideDepartureTime: '09:00',
          rideArrivalTime: '10:30',
          seatNumber: 12,
          departureStationId: 'station-a',
          arrivalStationId: 'station-b',
          passenger: {
            id: 'passenger-1',
            firstName: 'Marko',
            lastName: 'Markovic',
            phone: '+381601234567',
            isActive: true
          }
        }
      ];

      const updates: Array<Record<string, unknown>> = [];

      return {
        updates,
        tx: {
          reservation: {
            findMany: jest.fn(async () => reservations.map((item) => ({ ...item }))),
            update: jest.fn(async ({ where, data }: never) => {
              const target = reservations.find(
                (item) => item.id === (where as { id: string }).id
              )!;
              const patch = data as Record<string, unknown>;
              updates.push({ id: target.id, ...patch });
              Object.assign(target, patch);

              return target;
            })
          },
          station: { findMany: jest.fn().mockResolvedValue([]) },
          ride: {
            findMany: jest.fn(async () => [
              written ? windowedRide('10:00', '11:30') : windowedRide('09:00', '10:30')
            ]),
            update: jest.fn(async () => {
              written = true;
            }),
            findFirst: jest.fn(async () =>
              written ? storedRide('10:00', '11:30') : storedRide('09:00', '10:30')
            )
          },
          rideDaySchedule: { create: jest.fn(), deleteMany: jest.fn() }
        }
      };
    };

    const movedLater = {
      daySchedules: [{ dayOfWeek, stationTimes: timesAt('10:00', '11:30') }]
    };

    let harness: ReturnType<typeof transactionMoving>;

    beforeEach(() => {
      harness = transactionMoving();
      prismaMock.$transaction.mockImplementation(async (fn: never) =>
        (fn as unknown as (tx: unknown) => Promise<unknown>)(harness.tx)
      );
    });

    it('refuses, and says the reservations can be moved rather than only overridden', async () => {
      await expect(service.update(auth, 'ride-1', movedLater)).rejects.toMatchObject({
        response: {
          code: 'WOULD_BREAK_RESERVATIONS',
          invariant: 'reservation.reachable',
          affectedCount: 1,
          repairable: true,
          repairMessage: 'Premesta 1 rezervaciju na novo vreme polaska i slobodno sediste.'
        }
      });

      // Refused means refused: nothing was moved on the way out.
      expect(harness.updates).toHaveLength(0);
    });

    it('moves the reservation onto the new departure when asked to repair', async () => {
      await expect(
        service.update(auth, 'ride-1', { ...movedLater, repairBreakingChange: true })
      ).resolves.toBeDefined();

      expect(harness.updates).toEqual([
        expect.objectContaining({
          id: 'reservation-1',
          rideDepartureTime: '10:00',
          rideArrivalTime: '11:30'
        })
      ]);
    });

    it('leaves the reservation where it is when the caller only overrides', async () => {
      await expect(
        service.update(auth, 'ride-1', { ...movedLater, confirmBreakingChange: true })
      ).resolves.toBeDefined();

      // Confirming is the other answer: the write lands and the orphan stays
      // for the integrity report to show.
      expect(harness.updates).toHaveLength(0);
    });
  });
});
