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
    },
    refreshSession: {
      updateMany: jest.fn()
    },
    auditEvent: {
      create: jest.fn()
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
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) => {
      if (typeof callback === 'function') {
        return callback(prismaMock);
      }

      return [[], 0];
    });
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
          createdById: 'admin-1',
          updatedById: 'admin-1',
          username: 'manager-a',
          email: 'manager-a@demo.local',
          role: UserRole.MANAGER,
          requirePasswordChange: false,
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
      createdById: 'admin-1',
      updatedById: 'admin-1',
      username: 'manager-a',
      email: 'manager-a@demo.local',
      role: UserRole.MANAGER,
      requirePasswordChange: false,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const result = await service.softDelete(auth, 'user-2');

    expect(result.isActive).toBe(false);
  });

  it('injects createdById and updatedById from auth actor on create', async () => {
    prismaMock.user.create.mockResolvedValue({
      id: 'user-2',
      tenantId: 'tenant-1',
      createdById: 'admin-1',
      updatedById: 'admin-1',
      username: 'manager-a',
      email: 'manager-a@demo.local',
      role: UserRole.MANAGER,
      requirePasswordChange: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await service.create(auth, {
      username: 'manager-a',
      email: 'manager-a@demo.local',
      password: 'strong-password-123',
      role: UserRole.MANAGER
    });

    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdById: auth.sub,
          updatedById: auth.sub
        })
      })
    );
  });

  it('updates updatedById and updatedAt without modifying createdById on update', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'user-2' });
    prismaMock.user.update.mockResolvedValue({
      id: 'user-2',
      tenantId: 'tenant-1',
      createdById: 'admin-1',
      updatedById: 'admin-1',
      username: 'manager-a',
      email: 'manager-a@demo.local',
      role: UserRole.STAFF,
      requirePasswordChange: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await service.update(auth, 'user-2', {
      role: UserRole.STAFF
    });

    const updateCall = prismaMock.user.update.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };

    expect(updateCall.data).toEqual(
      expect.objectContaining({
        role: UserRole.STAFF,
        updatedById: auth.sub
      })
    );
    expect(updateCall.data).toHaveProperty('updatedAt');
    expect(updateCall.data).not.toHaveProperty('createdById');
  });

  it('rejects self soft delete', async () => {
    await expect(service.softDelete(auth, auth.sub)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('resets password, revokes active sessions, and writes audit event', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'user-2' });
    prismaMock.user.update.mockResolvedValue({
      id: 'user-2',
      tenantId: 'tenant-1',
      createdById: 'admin-1',
      updatedById: 'admin-1',
      username: 'manager-a',
      email: 'manager-a@demo.local',
      role: UserRole.MANAGER,
      requirePasswordChange: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    prismaMock.refreshSession.updateMany.mockResolvedValue({ count: 2 });
    prismaMock.auditEvent.create.mockResolvedValue({ id: 'evt-1' });

    const result = await service.resetPassword(auth, 'user-2', {
      newPassword: 'new-strong-password-123'
    });

    expect(result.requirePasswordChange).toBe(true);
    expect(prismaMock.refreshSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          userId: 'user-2',
          revokedAt: null
        })
      })
    );
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          actorUserId: 'admin-1',
          targetUserId: 'user-2',
          type: 'PASSWORD_RESET_ADMIN'
        })
      })
    );
  });
});
