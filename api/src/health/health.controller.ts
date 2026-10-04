import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Liveness check with database connectivity' })
  @ApiOkResponse({
    schema: {
      example: {
        status: 'ok',
        db: 'up',
        commit: 'bd01855745f3c2a1e0b7d9c6f4a8e2b1c3d5f7a9',
        timestamp: '2026-03-13T00:00:00.000Z'
      }
    }
  })
  @ApiServiceUnavailableResponse({ description: 'Database is unavailable' })
  async health() {
    return this.healthService.health();
  }

  @Get('readiness')
  @Public()
  @ApiOperation({ summary: 'Readiness check for serving traffic' })
  @ApiOkResponse({
    schema: {
      example: {
        status: 'ready',
        db: 'up',
        timestamp: '2026-03-13T00:00:00.000Z'
      }
    }
  })
  @ApiServiceUnavailableResponse({ description: 'Database is unavailable' })
  async readiness() {
    return this.healthService.readiness();
  }
}
