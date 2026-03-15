import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { hash } from 'bcryptjs';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let mutablePasswordHash: string;

  const prismaMock = {
    $transaction: jest.fn(),
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    enableShutdownHooks: jest.fn(),
    isHealthy: jest.fn(),
    tenant: {
      findUnique: jest.fn()
    },
    user: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn()
    },
    refreshSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn()
    },
    auditEvent: {
      create: jest.fn()
    }
  };

  const jwtServiceMock = {
    sign: jest.fn(() => 'access-token'),
    verify: jest.fn()
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mutablePasswordHash = await hash('strong-password-123', 10);

    prismaMock.tenant.findUnique.mockImplementation(async ({ where }: { where: { slug: string } }) => {
      if (where.slug === 'demo-tenant') {
        return {
          id: 'tenant-1',
          slug: 'demo-tenant',
          isActive: true
        };
      }

      if (where.slug === 'other-tenant') {
        return {
          id: 'tenant-2',
          slug: 'other-tenant',
          isActive: true
        };
      }

      return null;
    });

    jwtServiceMock.verify.mockImplementation((token: string) => {
      if (token === 'access-token-admin') {
        return {
          sub: 'admin-1',
          tenantId: 'tenant-1',
          role: UserRole.ADMIN,
          username: 'demo-admin'
        };
      }

      if (token === 'access-token-manager') {
        return {
          sub: 'manager-1',
          tenantId: 'tenant-1',
          role: UserRole.MANAGER,
          username: 'demo-manager'
        };
      }

      if (token === 'access-token-staff') {
        return {
          sub: 'staff-1',
          tenantId: 'tenant-1',
          role: UserRole.STAFF,
          username: 'demo-staff'
        };
      }

      if (token === 'access-token-admin-other') {
        return {
          sub: 'admin-2',
          tenantId: 'tenant-2',
          role: UserRole.ADMIN,
          username: 'other-admin'
        };
      }

      if (token === 'access-token-admin-2') {
        return {
          sub: 'admin-9',
          tenantId: 'tenant-1',
          role: UserRole.ADMIN,
          username: 'demo-admin-2'
        };
      }

      throw new Error('invalid token');
    });
    jwtServiceMock.sign.mockReturnValue('access-token');

    prismaMock.user.create.mockResolvedValue({
      id: 'user-2',
      tenantId: 'tenant-1',
      createdById: 'admin-1',
      updatedById: 'admin-1',
      username: 'ops-manager',
      email: 'ops.manager@demo.local',
      role: UserRole.MANAGER,
      requirePasswordChange: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    prismaMock.$transaction.mockImplementation(async (input: unknown) => {
      if (typeof input === 'function') {
        return input(prismaMock);
      }

      return [
        [
          {
            id: 'admin-1',
            tenantId: 'tenant-1',
            createdById: null,
            updatedById: null,
            username: 'demo-admin',
            email: 'admin@demo.local',
            role: UserRole.ADMIN,
            requirePasswordChange: false,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ],
        1
      ];
    });

    prismaMock.user.findFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      if (where.id) {
        return { id: 'user-2' };
      }

      return {
        id: 'user-2',
        tenantId: 'tenant-1',
        username: 'ops-manager',
        email: 'ops.manager@demo.local',
        passwordHash: mutablePasswordHash,
        role: UserRole.MANAGER,
        requirePasswordChange: false,
        isActive: true
      };
    });
    prismaMock.user.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      if (typeof data.passwordHash === 'string') {
        mutablePasswordHash = data.passwordHash;
      }

      return {
      id: 'user-2',
      tenantId: 'tenant-1',
      createdById: 'admin-1',
      updatedById: 'admin-1',
      username: 'ops-manager',
      email: 'ops.manager@demo.local',
      role: UserRole.STAFF,
      requirePasswordChange: Boolean(data.requirePasswordChange),
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date()
      };
    });
    prismaMock.refreshSession.create.mockResolvedValue({ id: 'session-1' });
    prismaMock.refreshSession.findUnique.mockResolvedValue(null);
    prismaMock.refreshSession.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.auditEvent.create.mockResolvedValue({ id: 'evt-1' });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(JwtService)
      .useValue(jwtServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true
      })
    );
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('admin can create manager and staff users', async () => {
    const managerResponse = await request(app.getHttpServer())
      .post('/users')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .send({
        username: 'ops-manager',
        email: 'ops.manager@demo.local',
        password: 'strong-password-123',
        role: UserRole.MANAGER
      })
      .expect(201);

    expect(managerResponse.body.role).toBe(UserRole.MANAGER);
    expect(managerResponse.body.createdById).toBe('admin-1');
    expect(managerResponse.body.updatedById).toBe('admin-1');

    prismaMock.user.create.mockResolvedValueOnce({
      id: 'user-3',
      tenantId: 'tenant-1',
      createdById: 'admin-1',
      updatedById: 'admin-1',
      username: 'ops-staff',
      email: 'ops.staff@demo.local',
      role: UserRole.STAFF,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const staffResponse = await request(app.getHttpServer())
      .post('/users')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .send({
        username: 'ops-staff',
        email: 'ops.staff@demo.local',
        password: 'strong-password-123',
        role: UserRole.STAFF
      })
      .expect(201);

    expect(staffResponse.body.role).toBe(UserRole.STAFF);
  });

  it('fails when duplicate username exists in the same tenant', async () => {
    prismaMock.user.create.mockRejectedValueOnce({
      code: 'P2002',
      meta: {
        target: ['tenantId', 'username']
      }
    });

    const response = await request(app.getHttpServer())
      .post('/users')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .send({
        username: 'ops-manager',
        email: 'new.email@demo.local',
        password: 'strong-password-123',
        role: UserRole.MANAGER
      })
      .expect(409);

    expect(response.body.message).toBe('Username already exists in this tenant');
  });

  it('allows same username in a different tenant', async () => {
    prismaMock.user.create.mockResolvedValueOnce({
      id: 'user-22',
      tenantId: 'tenant-2',
      username: 'ops-manager',
      email: 'ops.manager@other.local',
      role: UserRole.MANAGER,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const response = await request(app.getHttpServer())
      .post('/users')
      .set('X-Tenant-Slug', 'other-tenant')
      .set('Authorization', 'Bearer access-token-admin-other')
      .send({
        username: 'ops-manager',
        email: 'ops.manager@other.local',
        password: 'strong-password-123',
        role: UserRole.MANAGER
      })
      .expect(201);

    expect(response.body.tenantId).toBe('tenant-2');
    expect(response.body.username).toBe('ops-manager');
  });

  it('never returns sensitive password hash fields', async () => {
    const listResponse = await request(app.getHttpServer())
      .get('/users')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .expect(200);

    expect(listResponse.body.items[0]).not.toHaveProperty('passwordHash');

    const updateResponse = await request(app.getHttpServer())
      .patch('/users/user-2')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .send({ role: UserRole.STAFF, isActive: false })
      .expect(200);

    expect(updateResponse.body).not.toHaveProperty('passwordHash');
  });

  it('rejects body-injected audit ids as non-whitelisted fields', async () => {
    const response = await request(app.getHttpServer())
      .post('/users')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .send({
        username: 'ops-manager-2',
        email: 'ops.manager.2@demo.local',
        password: 'strong-password-123',
        role: UserRole.MANAGER,
        createdById: 'spoofed',
        updatedById: 'spoofed'
      })
      .expect(400);

    expect(response.body.message).toEqual(
      expect.arrayContaining([
        'property createdById should not exist',
        'property updatedById should not exist'
      ])
    );
  });

  it('tracks latest editor in updatedById while preserving createdById', async () => {
    prismaMock.user.update
      .mockResolvedValueOnce({
        id: 'user-2',
        tenantId: 'tenant-1',
        createdById: 'admin-1',
        updatedById: 'admin-1',
        username: 'ops-manager',
        email: 'ops.manager@demo.local',
        role: UserRole.STAFF,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .mockResolvedValueOnce({
        id: 'user-2',
        tenantId: 'tenant-1',
        createdById: 'admin-1',
        updatedById: 'admin-9',
        username: 'ops-manager',
        email: 'ops.manager@demo.local',
        role: UserRole.MANAGER,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

    const firstEdit = await request(app.getHttpServer())
      .patch('/users/user-2')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .send({ role: UserRole.STAFF, isActive: true })
      .expect(200);

    expect(firstEdit.body.createdById).toBe('admin-1');
    expect(firstEdit.body.updatedById).toBe('admin-1');

    const secondEdit = await request(app.getHttpServer())
      .patch('/users/user-2')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin-2')
      .send({ role: UserRole.MANAGER, isActive: true })
      .expect(200);

    expect(secondEdit.body.createdById).toBe('admin-1');
    expect(secondEdit.body.updatedById).toBe('admin-9');
  });

  it('supports full user update via put endpoint', async () => {
    const response = await request(app.getHttpServer())
      .put('/users/user-2')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .send({
        username: 'ops-manager-updated',
        email: 'ops.manager.updated@demo.local',
        role: UserRole.STAFF,
        isActive: false
      })
      .expect(200);

    expect(response.body).not.toHaveProperty('passwordHash');
    expect(response.body.id).toBe('user-2');
  });

  it('soft deletes user via delete endpoint', async () => {
    const response = await request(app.getHttpServer())
      .delete('/users/user-2')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .expect(200);

    expect(response.body.id).toBe('user-2');
    expect(response.body.isActive).toBe(false);
    expect(response.body).not.toHaveProperty('passwordHash');
  });

  it('blocks self soft delete for current admin', async () => {
    await request(app.getHttpServer())
      .delete('/users/admin-1')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .expect(403);
  });

  it('restricts manager and staff permissions as expected', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-manager')
      .send({
        username: 'new-user',
        email: 'new-user@demo.local',
        password: 'strong-password-123',
        role: UserRole.STAFF
      })
      .expect(403);

    await request(app.getHttpServer())
      .get('/users')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-staff')
      .expect(403);
  });

  it('admin can reset user password inside own tenant', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce({ id: 'user-2' });
    prismaMock.user.update.mockResolvedValueOnce({
      id: 'user-2',
      tenantId: 'tenant-1',
      createdById: 'admin-1',
      updatedById: 'admin-1',
      username: 'ops-manager',
      email: 'ops.manager@demo.local',
      role: UserRole.MANAGER,
      requirePasswordChange: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const response = await request(app.getHttpServer())
      .post('/users/user-2/reset-password')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .send({
        newPassword: 'new-strong-password-123',
        requirePasswordChange: true
      })
      .expect(201);

    expect(response.body.id).toBe('user-2');
    expect(response.body.requirePasswordChange).toBe(true);
    expect(prismaMock.refreshSession.updateMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.auditEvent.create).toHaveBeenCalledTimes(1);
  });

  it('manager and staff cannot reset passwords', async () => {
    await request(app.getHttpServer())
      .post('/users/user-2/reset-password')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-manager')
      .send({ newPassword: 'new-strong-password-123' })
      .expect(403);

    await request(app.getHttpServer())
      .post('/users/user-2/reset-password')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-staff')
      .send({ newPassword: 'new-strong-password-123' })
      .expect(403);
  });

  it('returns not found for cross-tenant or missing target user reset', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce(null);

    const response = await request(app.getHttpServer())
      .post('/users/user-missing/reset-password')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .send({ newPassword: 'new-strong-password-123' })
      .expect(404);

    expect(response.body.message).toBe('User not found');
  });

  it('returns validation error for invalid password policy', async () => {
    const response = await request(app.getHttpServer())
      .post('/users/user-2/reset-password')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .send({ newPassword: 'short' })
      .expect(400);

    expect(response.body.message).toEqual(expect.arrayContaining(['newPassword must be longer than or equal to 8 characters']));
  });

  it('allows login with new password and rejects old password after reset', async () => {
    await request(app.getHttpServer())
      .post('/users/user-2/reset-password')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .send({
        newPassword: 'new-strong-password-123',
        requirePasswordChange: false
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Slug', 'demo-tenant')
      .send({ username: 'ops-manager', password: 'strong-password-123' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Slug', 'demo-tenant')
      .send({ username: 'ops-manager', password: 'new-strong-password-123' })
      .expect(200);
  });
});
