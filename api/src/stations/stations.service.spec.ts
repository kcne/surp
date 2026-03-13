import { ConflictException, NotFoundException } from '@nestjs/common';
import { StationCategory, UserRole } from '@prisma/client';
import { StationsService } from './stations.service';

describe('StationsService', () => {
  const prismaMock = {
    $transaction: jest.fn(),
    station: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    line: {
      count: jest.fn()
    },
    reservation: {
      count: jest.fn()
    }
  };

  const auth = {
    sub: 'admin-1',
    tenantId: 'tenant-1',
    role: UserRole.ADMIN,
    username: 'demo-admin'
  };

  let service: StationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StationsService(prismaMock as never);
  });

  it('creates station with actor-based audit fields', async () => {
    prismaMock.station.create.mockResolvedValue({
      id: 'station-1',
      tenantId: 'tenant-1',
      createdById: 'admin-1',
      updatedById: 'admin-1',
      name: 'Central Station',
      address: '1 Main Street',
      category: StationCategory.BUS_STATION,
      contactPhone: null,
      notes: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await service.create(auth, {
      name: 'Central Station',
      address: '1 Main Street',
      category: StationCategory.BUS_STATION
    });

    expect(prismaMock.station.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          createdById: 'admin-1',
          updatedById: 'admin-1'
        })
      })
    );
  });

  it('returns not found when station is outside tenant scope', async () => {
    prismaMock.station.findFirst.mockResolvedValue(null);

    await expect(service.getById(auth, 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('applies optional active filter while listing', async () => {
    prismaMock.$transaction.mockResolvedValue([[], 0]);

    await service.list(auth, { isActive: true });

    expect(prismaMock.station.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          isActive: true
        })
      })
    );
  });

  it('blocks delete when station is referenced by lines', async () => {
    prismaMock.station.findFirst.mockResolvedValue({ id: 'station-1' });
    prismaMock.$transaction.mockResolvedValue([1, 0]);

    await expect(service.remove(auth, 'station-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks delete when station is referenced by reservations', async () => {
    prismaMock.station.findFirst.mockResolvedValue({ id: 'station-1' });
    prismaMock.$transaction.mockResolvedValue([0, 2]);

    await expect(service.remove(auth, 'station-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('deletes station when no references exist', async () => {
    prismaMock.station.findFirst.mockResolvedValue({ id: 'station-1' });
    prismaMock.$transaction.mockResolvedValue([0, 0]);
    prismaMock.station.delete.mockResolvedValue({
      id: 'station-1',
      tenantId: 'tenant-1',
      createdById: 'admin-1',
      updatedById: 'admin-1',
      name: 'Central Station',
      address: '1 Main Street',
      category: StationCategory.BUS_STATION,
      contactPhone: null,
      notes: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const result = await service.remove(auth, 'station-1');

    expect(result.id).toBe('station-1');
    expect(prismaMock.station.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'station-1' }
      })
    );
  });
});
