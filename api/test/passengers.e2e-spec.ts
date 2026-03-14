import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { PassengerType, UserRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('PassengersController (e2e)', () => {
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
    passenger: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
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

    prismaMock.$transaction.mockResolvedValue([
      [
        {
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
        }
      ],
      1
    ]);

    prismaMock.passenger.findFirst.mockResolvedValue({
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

    prismaMock.passenger.update.mockResolvedValue({
      id: 'passenger-1',
      tenantId: 'tenant-1',
      createdById: 'admin-1',
      updatedById: 'admin-1',
      firstName: 'Mila',
      lastName: 'Markovic',
      phone: '+381640000111',
      email: 'mila.markovic@demo.local',
      passengerType: PassengerType.ADULT,
      isActive: false,
      notes: 'updated',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    prismaMock.passenger.delete.mockResolvedValue({
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

  it('prevents cross-tenant passenger access', async () => {
    const response = await request(app.getHttpServer())
      .get('/passengers/passenger-1')
      .set('X-Tenant-Slug', 'other-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .expect(403);

    expect(response.body.message).toBe('Tenant mismatch between token and request context');
  });

  it('returns validation errors for invalid payload', async () => {
    const response = await request(app.getHttpServer())
      .post('/passengers')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .send({
        lastName: 'Markovic',
        phone: '+381640000111'
      })
      .expect(400);

    expect(response.body.message).toEqual(
      expect.arrayContaining([
        'firstName should not be empty',
        'firstName must be a string'
      ])
    );
  });

  it('supports passenger CRUD and search', async () => {
    const created = await request(app.getHttpServer())
      .post('/passengers')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .send({
        firstName: 'Mila',
        lastName: 'Markovic',
        phone: '+381640000111',
        email: 'mila.markovic@demo.local',
        passengerType: PassengerType.ADULT,
        isActive: true
      })
      .expect(201);

    expect(created.body.id).toBe('passenger-1');

    const listed = await request(app.getHttpServer())
      .get('/passengers?page=1&pageSize=25&isActive=true')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .expect(200);

    expect(listed.body.total).toBe(1);

    const searched = await request(app.getHttpServer())
      .get('/passengers/search?search=mila')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .expect(200);

    expect(searched.body.total).toBe(1);

    const updated = await request(app.getHttpServer())
      .patch('/passengers/passenger-1')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .send({
        isActive: false,
        notes: 'updated'
      })
      .expect(200);

    expect(updated.body.isActive).toBe(false);

    prismaMock.$transaction.mockResolvedValueOnce([
      [
        {
          id: 'passenger-1',
          tenantId: 'tenant-1',
          createdById: 'admin-1',
          updatedById: 'admin-1',
          firstName: 'Mila',
          lastName: 'Markovic',
          phone: '+381640000111',
          email: 'mila.markovic@demo.local',
          passengerType: PassengerType.ADULT,
          isActive: false,
          notes: 'updated',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ],
      1
    ]);

    const inactiveList = await request(app.getHttpServer())
      .get('/passengers?isActive=false')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .expect(200);

    expect(inactiveList.body.total).toBe(1);

    const removed = await request(app.getHttpServer())
      .delete('/passengers/passenger-1')
      .set('X-Tenant-Slug', 'demo-tenant')
      .set('Authorization', 'Bearer access-token-admin')
      .expect(200);

    expect(removed.body.id).toBe('passenger-1');
  });
});
