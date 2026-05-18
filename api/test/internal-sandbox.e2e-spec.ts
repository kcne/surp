import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { InternalSandboxService } from '../src/internal-sandbox/internal-sandbox.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('InternalSandboxController (e2e)', () => {
  let app: INestApplication;

  const resetToken = 'test-sandbox-reset-token-at-least-32-chars';

  const prismaMock = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    enableShutdownHooks: jest.fn(),
    isHealthy: jest.fn()
  };

  const jwtServiceMock = {
    verify: jest.fn()
  };

  const internalSandboxServiceMock = {
    reset: jest.fn()
  };

  beforeEach(async () => {
    process.env.SANDBOX_RESET_TOKEN = resetToken;
    process.env.SANDBOX_DEMO_PASSWORD = 'demo-password';
    jest.clearAllMocks();

    internalSandboxServiceMock.reset.mockResolvedValue({
      tenantSlug: 'sandbox-demo',
      deleted: {},
      seeded: {
        users: 1,
        stations: 12,
        lines: 5,
        rides: 5,
        passengers: 36,
        reservations: 50
      },
      durationMs: 123
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(JwtService)
      .useValue(jwtServiceMock)
      .overrideProvider(InternalSandboxService)
      .useValue(internalSandboxServiceMock)
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

  it('rejects reset without bearer token', async () => {
    await request(app.getHttpServer()).post('/api/internal/sandbox/reset').expect(401);

    expect(internalSandboxServiceMock.reset).not.toHaveBeenCalled();
  });

  it('rejects reset with invalid bearer token', async () => {
    await request(app.getHttpServer())
      .post('/api/internal/sandbox/reset')
      .set('Authorization', 'Bearer wrong-token')
      .expect(401);

    expect(internalSandboxServiceMock.reset).not.toHaveBeenCalled();
  });

  it('runs reset with valid bearer token', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/internal/sandbox/reset')
      .set('Authorization', `Bearer ${resetToken}`)
      .expect(200);

    expect(internalSandboxServiceMock.reset).toHaveBeenCalledTimes(1);
    expect(response.body).toMatchObject({
      tenantSlug: 'sandbox-demo',
      seeded: {
        users: 1,
        stations: 12,
        lines: 5,
        rides: 5,
        passengers: 36,
        reservations: 50
      }
    });
  });
});
