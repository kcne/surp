import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const prismaMock = {
    $transaction: jest.fn(),
    user: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn()
    }
  };

  const auth = {
    sub: 'admin-1',
    tenantId: 'tenant-1',
    role: UserRole.ADMIN,
    username: 'demo-admin'
  };

  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockResolvedValue([[], 0]);
    service = new UsersService(prismaMock as never);
  });

  it('rejects creating ADMIN role users', async () => {
    await expect(
      service.create(auth, {
        username: 'tenant-admin-2',
        email: 'tenant-admin-2@demo.local',
        password: 'strong-password-123',
        role: UserRole.ADMIN
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('maps duplicate username unique violation to conflict error', async () => {
    prismaMock.user.create.mockRejectedValue({
      code: 'P2002',
      meta: {
        target: ['tenantId', 'username']
      }
    });

    await expect(
      service.create(auth, {
        username: 'manager-a',
        email: 'manager-a@demo.local',
        password: 'strong-password-123',
        role: UserRole.MANAGER
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns paginated users without sensitive fields', async () => {
    prismaMock.$transaction.mockResolvedValue([
      [
        {
          id: 'user-2',
          tenantId: 'tenant-1',
          username: 'manager-a',
          email: 'manager-a@demo.local',
          role: UserRole.MANAGER,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ],
      1
    ]);

    const result = await service.list(auth, {});

    expect(result.total).toBe(1);
    expect(result.items[0]).not.toHaveProperty('passwordHash');
  });

  it('throws not found on update when user is outside tenant', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);

    await expect(service.update(auth, 'missing-user', { isActive: false })).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it('rejects self-deactivation', async () => {
    await expect(service.update(auth, auth.sub, { isActive: false })).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it('soft deletes a tenant user by setting isActive false', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'user-2' });
    prismaMock.user.update.mockResolvedValue({
      id: 'user-2',
      tenantId: 'tenant-1',
      username: 'manager-a',
      email: 'manager-a@demo.local',
      role: UserRole.MANAGER,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const result = await service.softDelete(auth, 'user-2');

    expect(result.isActive).toBe(false);
  });

  it('rejects self soft delete', async () => {
    await expect(service.softDelete(auth, auth.sub)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
