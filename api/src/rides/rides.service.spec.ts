import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  ReservationStatus,
  RideExceptionType,
  RideStatus,
  RideType,
  UserRole
} from '@prisma/client';
import { RidesService } from './rides.service';

/** The token a refusal hands out, which is what the operator's answer carries back. */
async function refusalToken(refused: Promise<unknown>): Promise<string> {
  try {
    await refused;
  } catch (error) {
    const token = (error as { response?: { confirmationToken?: unknown } }).response
      ?.confirmationToken;

    if (typeof token === 'string') {
      return token;
    }
  }

  throw new Error('Expected the write to be refused with a confirmation token');
}

describe('RidesService', () => {
  const prismaMock = {
    $transaction: jest.fn(),
    // The schedule lock every guarded write takes first.
    $executeRaw: jest.fn().mockResolvedValue(1),
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
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn()
    },
    rideDayScheduleStationTime: {
      deleteMany: jest.fn(),
      createMany: jest.fn()
    },
    rideException: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
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
    // A ride with no weekday rows yet, so every submitted weekday is created.
    prismaMock.rideDaySchedule.findMany.mockResolvedValue([]);
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
    expect(prismaMock.reservation.findMany).not.toHaveBeenCalled();
  });

  it('returns missing-ride errors before scanning tenant reservations', async () => {
    prismaMock.ride.findFirst.mockResolvedValue(null);

    await expect(service.update(auth, 'ride-missing', { capacity: 30 })).rejects.toBeInstanceOf(
      NotFoundException
    );
    await expect(service.replaceDayTimes(auth, 'ride-missing', [])).rejects.toBeInstanceOf(
      NotFoundException
    );

    expect(prismaMock.reservation.findMany).not.toHaveBeenCalled();
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
        $executeRaw: jest.fn().mockResolvedValue(1),
        reservation: { findMany: jest.fn().mockResolvedValue(reservations) },
        station: { findMany: jest.fn().mockResolvedValue([]) },
        ride: {
          findMany: jest.fn(async () => [windowedRide(written ? capacityAfterWrite : 48)]),
          update: jest.fn(async () => {
            written = true;
          }),
          findFirst: jest.fn().mockResolvedValue({ ...rideOnSale, capacity: capacityAfterWrite })
        },
        rideDaySchedule: prismaMock.rideDaySchedule,
        rideDayScheduleStationTime: prismaMock.rideDayScheduleStationTime
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

    it('goes through once the caller answers with the token it was given', async () => {
      runUpdateAgainst([soldSeat], 30);
      const token = await refusalToken(service.update(auth, 'ride-1', { capacity: 30 }));

      runUpdateAgainst([soldSeat], 30);
      await expect(
        service.update(auth, 'ride-1', { capacity: 30, confirmationTokens: [token] })
      ).resolves.toMatchObject({ capacity: 30 });
    });

    it('refuses a bare confirmBreakingChange from a tab that predates tokens', async () => {
      runUpdateAgainst([soldSeat], 30);

      await expect(
        service.update(auth, 'ride-1', { capacity: 30, confirmBreakingChange: true })
      ).rejects.toMatchObject({
        response: {
          code: 'WOULD_BREAK_RESERVATIONS',
          staleClient: true,
          message: expect.stringContaining('Osvezite stranicu')
        }
      });
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
      callback({ $executeRaw: prismaMock.$executeRaw, rideException: prismaMock.rideException })
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
      $executeRaw: jest.fn().mockResolvedValue(1),
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
          $executeRaw: jest.fn().mockResolvedValue(1),
          reservation: {
            findMany: jest.fn(async () => reservations.map((item) => ({ ...item }))),
            update: jest.fn(async ({ where, data }: never) => {
              const target = reservations.find((item) => item.id === (where as { id: string }).id)!;
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
          rideDaySchedule: prismaMock.rideDaySchedule,
          rideDayScheduleStationTime: prismaMock.rideDayScheduleStationTime
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
      const token = await refusalToken(service.update(auth, 'ride-1', movedLater));
      harness = transactionMoving();

      await expect(
        service.update(auth, 'ride-1', { ...movedLater, repairTokens: [token] })
      ).resolves.toBeDefined();

      expect(harness.updates).toEqual([
        expect.objectContaining({
          id: 'reservation-1',
          rideDepartureTime: '10:00',
          rideArrivalTime: '11:30'
        })
      ]);
      expect(harness.tx.reservation.findMany).toHaveBeenCalledTimes(3);
    });

    it('leaves the reservation where it is when the caller only overrides', async () => {
      const token = await refusalToken(service.update(auth, 'ride-1', movedLater));
      harness = transactionMoving();

      await expect(
        service.update(auth, 'ride-1', { ...movedLater, confirmationTokens: [token] })
      ).resolves.toBeDefined();

      // Confirming is the other answer: the write lands and the orphan stays
      // for the integrity report to show.
      expect(harness.updates).toHaveLength(0);
    });
  });

  describe('keeping departure identities', () => {
    const storedRecurring = (
      daySchedules: Array<{ dayOfWeek: number }>,
      overrides: Record<string, unknown> = {}
    ) => ({
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
      daySchedules: daySchedules.map(({ dayOfWeek }) => ({
        dayOfWeek,
        stationTimes: timesAt('09:00', '10:30')
      })),
      exceptions: [],
      ...overrides
    });

    const timesAt = (departure: string, arrival: string) => [
      { stationId: 'station-a', orderIndex: 0, time: departure },
      { stationId: 'station-b', orderIndex: 1, time: arrival }
    ];

    const weekday = (dayOfWeek: number, departure = '09:00') => ({
      dayOfWeek,
      stationTimes: timesAt(departure, '10:30')
    });

    it('keeps a weekday row when its times change, retires a dropped one and restores a returning one', async () => {
      prismaMock.ride.findFirst.mockResolvedValue(
        storedRecurring([{ dayOfWeek: 1 }, { dayOfWeek: 2 }])
      );
      prismaMock.rideDaySchedule.findMany.mockResolvedValue([
        { id: 'schedule-mon', dayOfWeek: 1, retiredAt: null },
        { id: 'schedule-tue', dayOfWeek: 2, retiredAt: null },
        { id: 'schedule-wed', dayOfWeek: 3, retiredAt: new Date('2026-04-01T00:00:00.000Z') }
      ]);

      await service.replaceDayTimes(auth, 'ride-1', [weekday(1, '09:15'), weekday(3), weekday(4)]);

      // Tuesday was dropped: retired, not deleted.
      expect(prismaMock.rideDaySchedule.updateMany).toHaveBeenCalledTimes(1);
      expect(prismaMock.rideDaySchedule.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['schedule-tue'] }, tenantId: 'tenant-1' },
        data: expect.objectContaining({ retiredAt: expect.any(Date), updatedById: 'admin-1' })
      });

      // Monday kept its row; Wednesday got its old row back.
      const updatedIds = prismaMock.rideDaySchedule.update.mock.calls.map(
        ([args]: [{ where: { id: string } }]) => args.where.id
      );
      expect(updatedIds).toEqual(['schedule-mon', 'schedule-wed']);
      for (const [args] of prismaMock.rideDaySchedule.update.mock.calls) {
        expect(args.data).toEqual(expect.objectContaining({ retiredAt: null }));
      }

      // Their station times are rewritten under the same row.
      expect(prismaMock.rideDayScheduleStationTime.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            rideDayScheduleId: 'schedule-mon',
            orderIndex: 0,
            time: '09:15'
          }),
          expect.objectContaining({
            rideDayScheduleId: 'schedule-mon',
            orderIndex: 1,
            time: '10:30'
          })
        ]
      });

      // Only Thursday, which never existed, is new.
      expect(prismaMock.rideDaySchedule.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.rideDaySchedule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ dayOfWeek: 4 })
      });
    });

    it('retires every weekday when a recurring ride becomes one-time, and restores them when it goes back', async () => {
      prismaMock.ride.findFirst.mockResolvedValue(storedRecurring([{ dayOfWeek: 1 }]));
      prismaMock.rideDaySchedule.findMany.mockResolvedValue([
        { id: 'schedule-mon', dayOfWeek: 1, retiredAt: null }
      ]);

      await service.update(auth, 'ride-1', {
        type: RideType.ONE_TIME,
        recurringStartDate: null as never,
        oneTimeDate: '2026-05-04',
        oneTimeDepartureTime: '09:00',
        oneTimeArrivalTime: '10:30',
        daySchedules: []
      });

      expect(prismaMock.rideDaySchedule.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['schedule-mon'] }, tenantId: 'tenant-1' },
        data: expect.objectContaining({ retiredAt: expect.any(Date) })
      });
      expect(prismaMock.rideDaySchedule.create).not.toHaveBeenCalled();

      jest.clearAllMocks();
      prismaMock.ride.findFirst.mockResolvedValue(
        storedRecurring([], {
          type: RideType.ONE_TIME,
          recurringStartDate: null,
          oneTimeDate: new Date('2026-05-04T00:00:00.000Z'),
          oneTimeDepartureTime: '09:00',
          oneTimeArrivalTime: '10:30'
        })
      );
      prismaMock.rideDaySchedule.findMany.mockResolvedValue([
        { id: 'schedule-mon', dayOfWeek: 1, retiredAt: new Date('2026-04-01T00:00:00.000Z') }
      ]);

      await service.update(auth, 'ride-1', {
        type: RideType.RECURRING,
        recurringStartDate: '2026-03-20',
        oneTimeDate: null as never,
        oneTimeDepartureTime: null as never,
        oneTimeArrivalTime: null as never,
        daySchedules: [weekday(1)]
      });

      expect(prismaMock.rideDaySchedule.update).toHaveBeenCalledWith({
        where: { id: 'schedule-mon' },
        data: expect.objectContaining({ retiredAt: null })
      });
      expect(prismaMock.rideDaySchedule.create).not.toHaveBeenCalled();
      expect(prismaMock.rideDaySchedule.updateMany).not.toHaveBeenCalled();
    });

    const exceptionRow = (overrides: Record<string, unknown> = {}) => ({
      id: 'exception-1',
      exceptionDate: new Date('2026-05-04T00:00:00.000Z'),
      type: RideExceptionType.ADDITIONAL,
      departureTime: '15:00',
      arrivalTime: '16:30',
      createdById: 'admin-1',
      updatedById: 'admin-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    });

    it('retires an additional departure instead of deleting it', async () => {
      prismaMock.ride.findFirst.mockResolvedValue(storedRecurring([{ dayOfWeek: 1 }]));
      prismaMock.rideException.findFirst.mockResolvedValue(exceptionRow());
      prismaMock.rideException.update.mockResolvedValue(exceptionRow());

      await service.removeException(auth, 'ride-1', 'exception-1');

      expect(prismaMock.rideException.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ retiredAt: null }) })
      );
      expect(prismaMock.rideException.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'exception-1' },
          data: expect.objectContaining({ retiredAt: expect.any(Date) })
        })
      );
      expect(prismaMock.rideException.delete).not.toHaveBeenCalled();
    });

    it('still deletes a SKIP, which nobody is booked on', async () => {
      prismaMock.ride.findFirst.mockResolvedValue(storedRecurring([{ dayOfWeek: 1 }]));
      const skip = exceptionRow({
        type: RideExceptionType.SKIP,
        departureTime: null,
        arrivalTime: null
      });
      prismaMock.rideException.findFirst.mockResolvedValue(skip);
      prismaMock.rideException.delete.mockResolvedValue(skip);

      await service.removeException(auth, 'ride-1', 'exception-1');

      expect(prismaMock.rideException.delete).toHaveBeenCalled();
      expect(prismaMock.rideException.update).not.toHaveBeenCalled();
    });

    it('does not find a retired exception to remove', async () => {
      prismaMock.ride.findFirst.mockResolvedValue(storedRecurring([{ dayOfWeek: 1 }]));
      prismaMock.rideException.findFirst.mockResolvedValue(null);

      await expect(service.removeException(auth, 'ride-1', 'exception-1')).rejects.toBeInstanceOf(
        NotFoundException
      );
      expect(prismaMock.rideException.update).not.toHaveBeenCalled();
      expect(prismaMock.rideException.delete).not.toHaveBeenCalled();
    });

    it('ignores retired additional departures when checking a new one is not a duplicate', async () => {
      prismaMock.ride.findFirst.mockResolvedValue(storedRecurring([{ dayOfWeek: 1 }]));
      prismaMock.rideException.findMany.mockResolvedValue([]);
      prismaMock.rideException.create.mockResolvedValue(exceptionRow({ id: 'exception-2' }));

      await service.addException(auth, 'ride-1', {
        date: '2026-05-04',
        type: RideExceptionType.ADDITIONAL,
        departureTime: '15:00',
        arrivalTime: '16:30'
      });

      expect(prismaMock.rideException.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ retiredAt: null }) })
      );
    });

    describe('editing an additional departure in place', () => {
      beforeEach(() => {
        prismaMock.ride.findFirst.mockResolvedValue(storedRecurring([{ dayOfWeek: 1 }]));
      });

      it('keeps its ID and moves only the reservations that name it', async () => {
        prismaMock.rideException.findFirst
          .mockResolvedValueOnce(exceptionRow())
          .mockResolvedValueOnce(null);
        prismaMock.rideException.update.mockResolvedValue(
          exceptionRow({ departureTime: '15:30', arrivalTime: '17:00' })
        );

        const result = await service.updateException(auth, 'ride-1', 'exception-1', {
          departureTime: '15:30',
          arrivalTime: '17:00'
        });

        expect(result).toEqual(
          expect.objectContaining({
            id: 'exception-1',
            departureTime: '15:30',
            arrivalTime: '17:00'
          })
        );
        expect(prismaMock.rideException.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'exception-1' },
            data: expect.objectContaining({ departureTime: '15:30', arrivalTime: '17:00' })
          })
        );
        expect(prismaMock.rideException.create).not.toHaveBeenCalled();
        expect(prismaMock.reservation.updateMany).toHaveBeenCalledWith({
          where: {
            tenantId: 'tenant-1',
            rideExceptionId: 'exception-1',
            status: ReservationStatus.ACTIVE
          },
          data: { rideDepartureTime: '15:30', rideArrivalTime: '17:00', updatedById: 'admin-1' }
        });
      });

      it('refuses to edit a SKIP', async () => {
        prismaMock.rideException.findFirst.mockResolvedValue(
          exceptionRow({ type: RideExceptionType.SKIP, departureTime: null, arrivalTime: null })
        );

        await expect(
          service.updateException(auth, 'ride-1', 'exception-1', {
            departureTime: '15:30',
            arrivalTime: '17:00'
          })
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(prismaMock.rideException.update).not.toHaveBeenCalled();
      });

      it('does not find a retired or foreign exception', async () => {
        prismaMock.rideException.findFirst.mockResolvedValue(null);

        await expect(
          service.updateException(auth, 'ride-1', 'exception-1', {
            departureTime: '15:30',
            arrivalTime: '17:00'
          })
        ).rejects.toBeInstanceOf(NotFoundException);
        expect(prismaMock.rideException.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              id: 'exception-1',
              rideId: 'ride-1',
              tenantId: 'tenant-1',
              retiredAt: null
            })
          })
        );
      });

      it('refuses times another live additional departure on that date already has', async () => {
        prismaMock.rideException.findFirst
          .mockResolvedValueOnce(exceptionRow())
          .mockResolvedValueOnce({ id: 'exception-2' });

        await expect(
          service.updateException(auth, 'ride-1', 'exception-1', {
            departureTime: '18:00',
            arrivalTime: '19:30'
          })
        ).rejects.toBeInstanceOf(ConflictException);
        expect(prismaMock.rideException.findFirst).toHaveBeenLastCalledWith({
          where: expect.objectContaining({
            retiredAt: null,
            departureTime: '18:00',
            arrivalTime: '19:30',
            id: { not: 'exception-1' }
          }),
          select: { id: true }
        });
        expect(prismaMock.rideException.update).not.toHaveBeenCalled();
      });

      it('refuses equal departure and arrival times before touching anything', async () => {
        await expect(
          service.updateException(auth, 'ride-1', 'exception-1', {
            departureTime: '15:30',
            arrivalTime: '15:30'
          })
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
      });
    });
  });
});
