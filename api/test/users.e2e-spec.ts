import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('UsersController (e2e)', () => {
  let app: INestApplication;

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
    }
  };

  const jwtServiceMock = {
    sign: jest.fn(() => 'access-token'),
    verify: jest.fn()
  };

  beforeEach(async () => {
    jest.clearAllMocks();

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

      throw new Error('invalid token');
    });

    prismaMock.user.create.mockResolvedValue({
      id: 'user-2',
      tenantId: 'tenant-1',
      username: 'ops-manager',
      email: 'ops.manager@demo.local',
      role: UserRole.MANAGER,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    prismaMock.$transaction.mockResolvedValue([
      [
        {
          id: 'admin-1',
          tenantId: 'tenant-1',
          username: 'demo-admin',
          email: 'admin@demo.local',
          role: UserRole.ADMIN,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ],
      1
    ]);

    prismaMock.user.findFirst.mockResolvedValue({ id: 'user-2' });
    prismaMock.user.update.mockResolvedValue({
      id: 'user-2',
      tenantId: 'tenant-1',
      username: 'ops-manager',
      email: 'ops.manager@demo.local',
      role: UserRole.STAFF,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(JwtService)
      .useValue(jwtServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
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

    prismaMock.user.create.mockResolvedValueOnce({
      id: 'user-3',
      tenantId: 'tenant-1',
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
});
