import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('MarketingLeadsController (e2e)', () => {
  let app: INestApplication;

  const prismaMock = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    enableShutdownHooks: jest.fn(),
    isHealthy: jest.fn()
  };

  const jwtServiceMock = {
    verify: jest.fn()
  };

  beforeEach(async () => {
    jest.clearAllMocks();

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
      message: 'Marketing lead received.'
    });
    expect(response.body.id).toMatch(/^mlead_/);
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
