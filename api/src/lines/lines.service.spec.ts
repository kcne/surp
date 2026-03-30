import {
  BadRequestException,
  ConflictException,
  NotFoundException
} from '@nestjs/common';
import { LineDirection, LineDirectionMode, ReservationStatus, RideStatus, UserRole } from '@prisma/client';
import { LinesService } from './lines.service';

describe('LinesService', () => {
  const prismaMock = {
    $transaction: jest.fn(),
    line: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    ride: {
      count: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn()
    },
    reservation: {
      updateMany: jest.fn()
    },
    lineStop: {
      createMany: jest.fn(),
      deleteMany: jest.fn()
    },
    station: {
      findMany: jest.fn()
    }
  };

  const auth = {
    sub: 'admin-1',
    tenantId: 'tenant-1',
    role: UserRole.ADMIN,
    username: 'demo-admin'
  };

  const baseLine = {
    id: 'line-1',
    tenantId: 'tenant-1',
    createdById: 'admin-1',
    updatedById: 'admin-1',
    name: 'Central - North',
    departureStationId: 'station-a',
    arrivalStationId: 'station-b',
    directionMode: LineDirectionMode.BOTH,
    direction: LineDirection.OUTBOUND,
    pairKey: 'central-north-1',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    departureStation: {
      id: 'station-a',
      name: 'Central',
      address: '1 Main St',
      category: null,
      isActive: true
    },
    arrivalStation: {
      id: 'station-b',
      name: 'North',
      address: '2 Main St',
      category: null,
      isActive: true
    },
    intermediateStops: [] as Array<{ stationId: string; orderIndex: number; station: { name: string } }>
  };

  let service: LinesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LinesService(prismaMock as never);
  });

  it('rejects duplicate order index in intermediate stops', async () => {
    prismaMock.station.findMany.mockResolvedValue([
      { id: 'station-a', name: 'Central' },
      { id: 'station-b', name: 'North' },
      { id: 'station-c', name: 'Mid 1' },
      { id: 'station-d', name: 'Mid 2' }
    ]);

    await expect(
      service.create(auth, {
        departureStationId: 'station-a',
        arrivalStationId: 'station-b',
        intermediateStops: [
          { stationId: 'station-c', orderIndex: 1 },
          { stationId: 'station-d', orderIndex: 1 }
        ]
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate station in intermediate stops', async () => {
    prismaMock.station.findMany.mockResolvedValue([
      { id: 'station-a', name: 'Central' },
      { id: 'station-b', name: 'North' },
      { id: 'station-c', name: 'Mid 1' }
    ]);

    await expect(
      service.create(auth, {
        departureStationId: 'station-a',
        arrivalStationId: 'station-b',
        intermediateStops: [
          { stationId: 'station-c', orderIndex: 1 },
          { stationId: 'station-c', orderIndex: 2 }
        ]
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('prevents duplicate reverse line creation for the same route', async () => {
    prismaMock.line.findFirst.mockResolvedValueOnce({
      ...baseLine,
      intermediateStops: [
        { stationId: 'station-c', orderIndex: 1, station: { name: 'Mid 1' } },
        { stationId: 'station-d', orderIndex: 2, station: { name: 'Mid 2' } }
      ]
    });

    prismaMock.line.findMany.mockResolvedValueOnce([
      {
        id: 'line-existing-reverse',
        intermediateStops: [
          { stationId: 'station-d', orderIndex: 1 },
          { stationId: 'station-c', orderIndex: 2 }
        ]
      }
    ]);

    await expect(service.createReverse(auth, 'line-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns not found when line is outside tenant scope', async () => {
    prismaMock.line.findFirst.mockResolvedValue(null);

    await expect(service.getById(auth, 'line-missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('filters by direction metadata while listing', async () => {
    prismaMock.$transaction.mockResolvedValue([[], 0]);

    await service.list(auth, {
      directionMode: LineDirectionMode.BOTH,
      direction: LineDirection.OUTBOUND,
      isActive: true
    });

    expect(prismaMock.line.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          directionMode: LineDirectionMode.BOTH,
          direction: LineDirection.OUTBOUND,
          isActive: true
        })
      })
    );
  });

  it('prevents deleting a line with active rides when cascade is disabled', async () => {
    prismaMock.line.findFirst.mockResolvedValue(baseLine);
    prismaMock.ride.count.mockResolvedValue(2);

    await expect(service.remove(auth, 'line-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prismaMock.line.delete).not.toHaveBeenCalled();
  });

  it('soft deletes a line when no active rides exist', async () => {
    prismaMock.line.findFirst.mockResolvedValue(baseLine);
    prismaMock.ride.count.mockResolvedValue(0);
    prismaMock.line.update.mockResolvedValue({
      ...baseLine,
      isActive: false
    });

    const result = await service.remove(auth, 'line-1');

    expect(prismaMock.line.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'line-1' },
        data: expect.objectContaining({
          isActive: false,
          updatedById: 'admin-1'
        })
      })
    );
    expect(result.isActive).toBe(false);
  });

  it('cascade soft deletes rides and cancels reservations for line removal', async () => {
    prismaMock.line.findFirst.mockResolvedValue(baseLine);

    const tx = {
      ride: {
        findMany: jest.fn().mockResolvedValue([{ id: 'ride-1' }]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      reservation: {
        updateMany: jest.fn().mockResolvedValue({ count: 3 })
      },
      line: {
        update: jest.fn().mockResolvedValue({
          ...baseLine,
          isActive: false
        })
      }
    };

    prismaMock.$transaction.mockImplementation(async (callback: (db: typeof tx) => unknown) => callback(tx));

    const result = await service.remove(auth, 'line-1', true);

    expect(tx.reservation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          status: ReservationStatus.ACTIVE
        }),
        data: expect.objectContaining({
          status: ReservationStatus.CANCELLED,
          updatedById: 'admin-1'
        })
      })
    );

    expect(tx.ride.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          lineId: 'line-1',
          status: { not: RideStatus.INACTIVE }
        }),
        data: {
          status: RideStatus.INACTIVE,
          updatedById: 'admin-1'
        }
      })
    );
    expect(result.isActive).toBe(false);
  });
});
