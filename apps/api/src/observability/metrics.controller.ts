import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { isMetricsEnabled } from './structured-logger';
import { MetricsService } from './metrics.service';

@Controller()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  /**
   * Prometheus scrape endpoint. Keep off the public internet (proxy deny / private net).
   * Disable with METRICS_ENABLED=false.
   */
  @Get('metrics')
  @Header('Cache-Control', 'no-store')
  async getMetrics(@Res({ passthrough: true }) res: Response): Promise<string> {
    if (!isMetricsEnabled()) {
      throw new NotFoundException();
    }
    res.setHeader('Content-Type', this.metrics.contentType());
    return this.metrics.render();
  }
}
