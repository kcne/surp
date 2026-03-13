import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness check with database connectivity' })
  @ApiOkResponse({
    schema: {
      example: {
        status: 'ok',
        db: 'up',
        timestamp: '2026-03-13T00:00:00.000Z'
      }
    }
  })
  @ApiServiceUnavailableResponse({ description: 'Database is unavailable' })
  async health() {
    return this.healthService.health();
  }

  @Get('readiness')
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
