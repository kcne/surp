import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { MarketingLeadsEmailService } from '../src/marketing-leads/marketing-leads-email.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('MarketingLeadsController (e2e)', () => {
  let app: INestApplication;

  const prismaMock = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    enableShutdownHooks: jest.fn(),
    isHealthy: jest.fn(),
    marketingLead: {
      create: jest.fn(),
      update: jest.fn()
    }
  };

  const jwtServiceMock = {
    verify: jest.fn()
  };
  const marketingLeadsEmailServiceMock = {
    sendLeadNotification: jest.fn()
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.marketingLead.create.mockResolvedValue({
      id: 'clwm0k6q40000s60m5zg7n3c2',
      status: 'NEW'
    });
    prismaMock.marketingLead.update.mockResolvedValue({});
    marketingLeadsEmailServiceMock.sendLeadNotification.mockResolvedValue({
      internalEmailSent: true,
      confirmationEmailSent: true
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(JwtService)
      .useValue(jwtServiceMock)
      .overrideProvider(MarketingLeadsEmailService)
      .useValue(marketingLeadsEmailServiceMock)
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

  it('accepts a valid public demo lead without auth', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/public/marketing/leads')
      .send({
        name: 'Petar Petrovic',
        email: 'petar@example.com',
        agencyName: 'Drina Bus',
        phone: '+381 64 123 4567',
        departuresPerDay: '6-20',
        message: 'Zelimo online rezervacije.'
      })
      .expect(201);

    expect(response.body).toMatchObject({
      id: 'clwm0k6q40000s60m5zg7n3c2',
      message: 'Marketing lead received.'
    });
    expect(response.body.id).not.toMatch(/^mlead_/);
    expect(prismaMock.marketingLead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'petar@example.com',
          agencyName: 'Drina Bus',
          departuresPerDay: 'SIX_TO_TWENTY'
        })
      })
    );
    expect(prismaMock.marketingLead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'clwm0k6q40000s60m5zg7n3c2' }
      })
    );
    expect(marketingLeadsEmailServiceMock.sendLeadNotification).toHaveBeenCalledWith(
      'clwm0k6q40000s60m5zg7n3c2',
      expect.objectContaining({
        email: 'petar@example.com',
        agencyName: 'Drina Bus'
      }),
      expect.any(String)
    );
  });

  it('rejects honeypot submissions', async () => {
    await request(app.getHttpServer())
      .post('/api/public/marketing/leads')
      .send({
        name: 'Spam Bot',
        email: 'spam@example.com',
        agencyName: 'Spam Agency',
        departuresPerDay: '1-5',
        website: 'https://spam.example'
      })
      .expect(400);
  });
});
