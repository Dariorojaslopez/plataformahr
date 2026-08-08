import { Controller, Get } from '@nestjs/common';
import { createHealthResponse, type HealthStatus } from '@talento/shared';

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): HealthStatus {
    return createHealthResponse();
  }
}
