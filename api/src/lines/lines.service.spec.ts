import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LineDirection, LineDirectionMode, UserRole } from '@prisma/client';
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

  let service: LinesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LinesService(prismaMock as never);
  });

  it('creates line with actor audit fields and direction metadata', async () => {
    prismaMock.station.findMany.mockResolvedValue([
      { id: 'station-a', name: 'Central' },
      { id: 'station-b', name: 'North' }
    ]);
    prismaMock.line.create.mockResolvedValue({
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
      }
    });

    await service.create(auth, {
      departureStationId: 'station-a',
      arrivalStationId: 'station-b',
      directionMode: LineDirectionMode.BOTH,
      direction: LineDirection.OUTBOUND,
      pairKey: 'central-north-1',
      isActive: true
    });

    expect(prismaMock.line.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          createdById: 'admin-1',
          updatedById: 'admin-1',
          directionMode: LineDirectionMode.BOTH,
          direction: LineDirection.OUTBOUND,
          pairKey: 'central-north-1'
        })
      })
    );
  });

  it('rejects invalid station references for route integrity', async () => {
    prismaMock.station.findMany.mockResolvedValue([{ id: 'station-a', name: 'Central' }]);

    await expect(
      service.create(auth, {
        departureStationId: 'station-a',
        arrivalStationId: 'station-missing'
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects same departure and arrival station', async () => {
    await expect(
      service.create(auth, {
        departureStationId: 'station-a',
        arrivalStationId: 'station-a'
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid direction logic for single mode with pair key', async () => {
    prismaMock.station.findMany.mockResolvedValue([
      { id: 'station-a', name: 'Central' },
      { id: 'station-b', name: 'North' }
    ]);

    await expect(
      service.create(auth, {
        departureStationId: 'station-a',
        arrivalStationId: 'station-b',
        directionMode: LineDirectionMode.SINGLE,
        direction: LineDirection.OUTBOUND,
        pairKey: 'not-allowed'
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid direction logic for return line without pair key', async () => {
    prismaMock.station.findMany.mockResolvedValue([
      { id: 'station-a', name: 'Central' },
      { id: 'station-b', name: 'North' }
    ]);

    await expect(
      service.create(auth, {
        departureStationId: 'station-a',
        arrivalStationId: 'station-b',
        directionMode: LineDirectionMode.BOTH,
        direction: LineDirection.RETURN
      })
    ).rejects.toBeInstanceOf(BadRequestException);
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
});
