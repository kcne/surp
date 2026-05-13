import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { StorefrontStatus } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('PublicStorefrontController (e2e)', () => {
  let app: INestApplication;

  const updatedAt = new Date('2026-05-13T12:00:00.000Z');
  const publishedAt = new Date('2026-05-13T12:05:00.000Z');

  const prismaMock = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    enableShutdownHooks: jest.fn(),
    isHealthy: jest.fn(),
    agencyStorefront: {
      findFirst: jest.fn()
    },
    ride: {
      findMany: jest.fn()
    }
  };

  const jwtServiceMock = {
    verify: jest.fn()
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prismaMock.agencyStorefront.findFirst.mockImplementation(({ where }: { where: { tenant: { slug: string } } }) => {
      if (where.tenant.slug !== 'test-agency') {
        return Promise.resolve(null);
      }

      return Promise.resolve({
        tenantId: 'tenant-1',
        status: StorefrontStatus.PUBLISHED,
        publishedAt,
        heroTitle: 'Test Agency',
        heroSubtitle: 'Comfortable intercity rides',
        heroImageUrl: 'https://cdn.example.test/hero.jpg',
        heroImageAlt: 'Coach bus at sunset',
        aboutMarkdown: '## About us',
        footerText: 'See you on board.',
        logoUrl: 'https://cdn.example.test/logo.png',
        logoAlt: 'Test Agency logo',
        primaryColor: '#1D4ED8',
        sectionsEnabled: {
          hero: true,
          rides: true,
          about: true
        },
        seoTitle: 'Test Agency rides',
        seoDescription: 'Book rides with Test Agency.',
        ogImageUrl: 'https://cdn.example.test/og.jpg',
        facebookUrl: 'https://facebook.com/testagency',
        instagramUrl: null,
        twitterUrl: null,
        linkedinUrl: null,
        websiteUrl: 'https://testagency.example.test',
        updatedAt,
        tenant: {
          slug: 'test-agency',
          name: 'Test Agency',
          timezone: 'Europe/Belgrade'
        }
      });
    });
    prismaMock.ride.findMany.mockResolvedValue([
      {
        id: 'ride-1',
        name: 'Morning ride',
        type: 'RECURRING',
        oneTimeDate: null,
        oneTimeDepartureTime: null,
        line: {
          name: 'Belgrade - Novi Sad',
          isActive: true,
          departureStation: {
            name: 'Beograd'
          },
          arrivalStation: {
            name: 'Novi Sad'
          }
        },
        daySchedules: [
          {
            dayOfWeek: 1,
            stationTimes: [{ orderIndex: 0, time: '08:00' }]
          },
          {
            dayOfWeek: 2,
            stationTimes: [{ orderIndex: 0, time: '08:00' }]
          }
        ]
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

  it('returns a safe published agency storefront without auth', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/public/agencies/test-agency')
      .expect(200);

    expect(response.body).toMatchObject({
      slug: 'test-agency',
      name: 'Test Agency',
      timezone: 'Europe/Belgrade',
      status: StorefrontStatus.PUBLISHED,
      heroTitle: 'Test Agency',
      primaryColor: '#1D4ED8',
      sectionsEnabled: {
        hero: true,
        rides: true,
        about: true
      },
      rides: [
        {
          id: 'ride-1',
          lineName: 'Belgrade - Novi Sad',
          origin: 'Beograd',
          destination: 'Novi Sad',
          departureTimes: ['08:00'],
          days: 'Pon, Uto'
        }
      ],
      socialLinks: {
        facebookUrl: 'https://facebook.com/testagency',
        instagramUrl: null,
        twitterUrl: null,
        linkedinUrl: null,
        websiteUrl: 'https://testagency.example.test'
      }
    });
    expect(response.body).not.toHaveProperty('tenantId');
  });

  it('returns 404 when no active published storefront exists', async () => {
    await request(app.getHttpServer())
      .get('/api/public/agencies/draft-agency')
      .expect(404);
  });
});
