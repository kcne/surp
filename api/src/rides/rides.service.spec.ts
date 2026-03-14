import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { RideExceptionType, RideStatus, RideType, UserRole } from '@prisma/client';
import { RidesService } from './rides.service';

describe('RidesService', () => {
  const prismaMock = {
    $transaction: jest.fn(),
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
    rideDayTime: {
      createMany: jest.fn(),
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
    service = new RidesService(prismaMock as never);
  });

  it('requires day-times for recurring rides', async () => {
    prismaMock.line.findFirst.mockResolvedValue({ id: 'line-1', name: 'Central - North' });

    await expect(
      service.create(auth, {
        lineId: 'line-1',
        name: 'Recurring Ride',
        capacity: 38,
        type: RideType.RECURRING,
        recurringStartDate: '2026-03-20',
        dayTimes: []
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires date and times for one-time rides', async () => {
    prismaMock.line.findFirst.mockResolvedValue({ id: 'line-1', name: 'Central - North' });

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
        arrivalStationId: 'station-b'
      },
      dayTimes: [{ dayOfWeek: 1, departureTime: '09:00', arrivalTime: '10:30' }],
      exceptions: []
    });

    await expect(
      service.update(auth, 'ride-1', {
        status: RideStatus.DRAFT
      })
    ).rejects.toBeInstanceOf(BadRequestException);
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
        arrivalStationId: 'station-b'
      },
      dayTimes: [{ dayOfWeek: 1, departureTime: '09:00', arrivalTime: '10:30' }],
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
});
