import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { StorefrontStatus, UserRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('StorefrontAdminController (e2e)', () => {
  let app: INestApplication;

  const updatedAt = new Date('2026-05-13T12:00:00.000Z');

  const baseStorefront = {
    tenantId: 'tenant-1',
    status: StorefrontStatus.DRAFT,
    publishedAt: null,
    heroTitle: 'Test Agency',
    heroSubtitle: 'Comfortable intercity rides',
    heroImageUrl: 'https://cdn.example.test/hero.jpg',
    heroImageAlt: 'Coach bus at sunset',
    aboutMarkdown: 'About us',
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
  };

  const prismaMock = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    enableShutdownHooks: jest.fn(),
    isHealthy: jest.fn(),
    tenant: {
      findUnique: jest.fn()
    },
    agencyStorefront: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn()
    }
  };

  const jwtServiceMock = {
    verify: jest.fn()
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    jwtServiceMock.verify.mockImplementation((token: string) => {
      if (token !== 'access-token-admin') {
        throw new Error('invalid token');
      }

      return {
        sub: 'admin-1',
        tenantId: 'tenant-1',
        role: UserRole.ADMIN,
        username: 'demo-admin'
      };
    });

    prismaMock.tenant.findUnique.mockImplementation(({ where }: { where: { id?: string; slug?: string } }) => {
      if (where.slug === 'test-agency' || where.id === 'tenant-1') {
        return Promise.resolve({
          id: 'tenant-1',
          slug: 'test-agency',
          name: 'Test Agency',
          timezone: 'Europe/Belgrade',
          isActive: true
        });
      }

      return Promise.resolve(null);
    });

    prismaMock.agencyStorefront.findUnique.mockResolvedValue(baseStorefront);
    prismaMock.agencyStorefront.upsert.mockImplementation(({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) =>
      Promise.resolve({
        ...baseStorefront,
        ...create,
        ...update,
        tenant: baseStorefront.tenant,
        updatedAt
      })
    );
    prismaMock.agencyStorefront.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({
        ...baseStorefront,
        ...data,
        publishedAt: data.publishedAt ?? baseStorefront.publishedAt,
        tenant: baseStorefront.tenant,
        updatedAt
      })
    );

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

  it('gets the current tenant storefront configuration', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/storefront')
      .set('Authorization', 'Bearer access-token-admin')
      .set('X-Tenant-Slug', 'test-agency')
      .expect(200);

    expect(response.body).toMatchObject({
      tenantId: 'tenant-1',
      tenantSlug: 'test-agency',
      tenantName: 'Test Agency',
      status: StorefrontStatus.DRAFT,
      heroTitle: 'Test Agency'
    });
  });

  it('upserts storefront content and normalizes primary color', async () => {
    const response = await request(app.getHttpServer())
      .put('/api/storefront')
      .set('Authorization', 'Bearer access-token-admin')
      .set('X-Tenant-Slug', 'test-agency')
      .send({
        heroTitle: ' Updated Agency ',
        primaryColor: '#1d4ed8',
        sectionsEnabled: {
          hero: true,
          rides: false,
          about: true
        }
      })
      .expect(200);

    expect(response.body.heroTitle).toBe('Updated Agency');
    expect(response.body.primaryColor).toBe('#1D4ED8');
    expect(response.body.sectionsEnabled.rides).toBe(false);
  });

  it('rejects primary colors that fail WCAG contrast against white', async () => {
    await request(app.getHttpServer())
      .put('/api/storefront')
      .set('Authorization', 'Bearer access-token-admin')
      .set('X-Tenant-Slug', 'test-agency')
      .send({
        primaryColor: '#FFFF00'
      })
      .expect(422);
  });

  it('publishes and unpublishes storefront content', async () => {
    const publishResponse = await request(app.getHttpServer())
      .post('/api/storefront/publish')
      .set('Authorization', 'Bearer access-token-admin')
      .set('X-Tenant-Slug', 'test-agency')
      .expect(200);

    expect(publishResponse.body.status).toBe(StorefrontStatus.PUBLISHED);
    expect(publishResponse.body.publishedAt).toBeTruthy();

    const unpublishResponse = await request(app.getHttpServer())
      .post('/api/storefront/unpublish')
      .set('Authorization', 'Bearer access-token-admin')
      .set('X-Tenant-Slug', 'test-agency')
      .expect(200);

    expect(unpublishResponse.body.status).toBe(StorefrontStatus.DRAFT);
    expect(unpublishResponse.body.publishedAt).toBeNull();
  });
});
