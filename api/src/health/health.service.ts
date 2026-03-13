import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async checkDatabase(): Promise<void> {
    const isHealthy = await this.prisma.isHealthy();

    if (!isHealthy) {
      throw new ServiceUnavailableException('Database is unavailable');
    }
  }

  async health(): Promise<{ status: string; db: string; timestamp: string }> {
    await this.checkDatabase();

    return {
      status: 'ok',
      db: 'up',
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
