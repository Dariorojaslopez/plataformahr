import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import {
  createHealthResponse,
  createReadyResponse,
  type HealthStatus,
  type ReadyStatus,
} from '@talento/shared';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: process is up. Does not check the database. */
  @Get('health')
  getHealth(): HealthStatus {
    return createHealthResponse();
  }

  /** Readiness: application can serve traffic (PostgreSQL reachable). */
  @Get('ready')
  async getReady(
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReadyStatus> {
    try {
      // Constant probe only — no user input.
      await this.prisma.$queryRawUnsafe('SELECT 1');
      return createReadyResponse(true);
    } catch {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
      return createReadyResponse(false);
    }
  }
}
