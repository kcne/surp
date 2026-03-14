import { NotFoundException } from '@nestjs/common';
import { PassengerType, UserRole } from '@prisma/client';
import { PassengersService } from './passengers.service';

describe('PassengersService', () => {
  const prismaMock = {
    $transaction: jest.fn(),
    passenger: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
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

  let service: PassengersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PassengersService(prismaMock as never);
  });

  it('creates passenger with actor-based audit fields', async () => {
    prismaMock.passenger.create.mockResolvedValue({
      id: 'passenger-1',
      tenantId: 'tenant-1',
      createdById: 'admin-1',
      updatedById: 'admin-1',
      firstName: 'Mila',
      lastName: 'Markovic',
      phone: '+381640000111',
      email: 'mila.markovic@demo.local',
      passengerType: PassengerType.ADULT,
      isActive: true,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await service.create(auth, {
      firstName: 'Mila',
      lastName: 'Markovic',
      phone: '+381640000111',
      email: 'mila.markovic@demo.local',
      passengerType: PassengerType.ADULT
    });

    expect(prismaMock.passenger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          createdById: 'admin-1',
          updatedById: 'admin-1'
        })
      })
    );
  });

  it('filters inactive passengers while listing', async () => {
    prismaMock.$transaction.mockResolvedValue([[], 0]);

    await service.list(auth, { isActive: false });

    expect(prismaMock.passenger.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          isActive: false
        })
      })
    );
  });

  it('applies search across name, phone, and email', async () => {
    prismaMock.$transaction.mockResolvedValue([[], 0]);

    await service.search(auth, { search: 'mila' });

    expect(prismaMock.passenger.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          OR: expect.arrayContaining([
            { firstName: { contains: 'mila', mode: 'insensitive' } },
            { lastName: { contains: 'mila', mode: 'insensitive' } },
            { phone: { contains: 'mila', mode: 'insensitive' } },
            { email: { contains: 'mila', mode: 'insensitive' } }
          ])
        })
      })
    );
  });

  it('returns not found when passenger is outside tenant scope', async () => {
    prismaMock.passenger.findFirst.mockResolvedValue(null);

    await expect(service.getById(auth, 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
