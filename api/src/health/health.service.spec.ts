import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  const prisma = { isHealthy: jest.fn() };

  function service(env: Record<string, string>) {
    return new HealthService(prisma as unknown as PrismaService, new ConfigService(env));
  }

  beforeEach(() => {
    prisma.isHealthy.mockResolvedValue(true);
  });

  it('reports the deployed commit', async () => {
    const sha = 'bd01855745f3c2a1e0b7d9c6f4a8e2b1c3d5f7a9';

    await expect(service({ RAILWAY_GIT_COMMIT_SHA: sha }).health()).resolves.toMatchObject({ commit: sha });
  });

  it.each<Record<string, string>>([{}, { RAILWAY_GIT_COMMIT_SHA: '' }])('reports no commit when the deploy did not set one (%p)', async (env) => {
    await expect(service(env).health()).resolves.toMatchObject({ commit: null });
  });

  it('still fails when the database is down', async () => {
    prisma.isHealthy.mockResolvedValue(false);

    await expect(service({ RAILWAY_GIT_COMMIT_SHA: 'abc' }).health()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
