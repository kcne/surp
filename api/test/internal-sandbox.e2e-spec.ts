import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { InternalSandboxService } from '../src/internal-sandbox/internal-sandbox.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('InternalSandboxController (e2e)', () => {
  let app: INestApplication;
  let previousResetToken: string | undefined;
  let previousDemoPassword: string | undefined;

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
    previousResetToken = process.env.SANDBOX_RESET_TOKEN;
    previousDemoPassword = process.env.SANDBOX_DEMO_PASSWORD;
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
      // ConfigModule validates env at AppModule import time. Use a fresh
      // ConfigService so this test reads its own token instead of a local .env
      // value captured before beforeEach ran.
      .overrideProvider(ConfigService)
      .useValue(new ConfigService())
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

    if (previousResetToken === undefined) {
      delete process.env.SANDBOX_RESET_TOKEN;
    } else {
      process.env.SANDBOX_RESET_TOKEN = previousResetToken;
    }

    if (previousDemoPassword === undefined) {
      delete process.env.SANDBOX_DEMO_PASSWORD;
    } else {
      process.env.SANDBOX_DEMO_PASSWORD = previousDemoPassword;
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
