import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { StorefrontStatus } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('PublicSeoController (e2e)', () => {
  let app: INestApplication;

  const prismaMock = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    enableShutdownHooks: jest.fn(),
    isHealthy: jest.fn(),
    agencyStorefront: {
      findMany: jest.fn()
    }
  };

  const jwtServiceMock = {
    verify: jest.fn()
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.agencyStorefront.findMany.mockResolvedValue([
      {
        updatedAt: new Date('2026-05-24T00:00:00.000Z'),
        tenant: {
          slug: 'test-agency',
          name: 'Test Agency'
        }
      }
    ]);

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

  it('returns published active agency sitemap data without auth', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/public/seo/sitemap-data')
      .expect(200);

    expect(response.body).toEqual({
      agencies: [
        {
          slug: 'test-agency',
          name: 'Test Agency',
          updatedAt: '2026-05-24T00:00:00.000Z'
        }
      ]
    });
    expect(prismaMock.agencyStorefront.findMany).toHaveBeenCalledWith({
      where: {
        status: StorefrontStatus.PUBLISHED,
        tenant: {
          isActive: true
        }
      },
      orderBy: {
        updatedAt: 'desc'
      },
      select: {
        updatedAt: true,
        tenant: {
          select: {
            slug: true,
            name: true
          }
        }
      }
    });
  });
});
