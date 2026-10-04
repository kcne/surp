import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  async checkDatabase(): Promise<void> {
    const isHealthy = await this.prisma.isHealthy();

    if (!isHealthy) {
      throw new ServiceUnavailableException('Database is unavailable');
    }
  }

  async health(): Promise<{ status: string; db: string; commit: string | null; timestamp: string }> {
    await this.checkDatabase();

    return {
      status: 'ok',
      db: 'up',
      // The deployed commit; its release tag is on the GitHub releases page.
      commit: this.configService.get<string>('RAILWAY_GIT_COMMIT_SHA') || null,
      timestamp: new Date().toISOString()
    };
  }

  async readiness(): Promise<{ status: string; db: string; timestamp: string }> {
    await this.checkDatabase();

    return {
      status: 'ready',
      db: 'up',
      timestamp: new Date().toISOString()
    };
  }
}
