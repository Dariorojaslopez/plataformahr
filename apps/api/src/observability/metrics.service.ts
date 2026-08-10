import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';
import { isMetricsEnabled } from './structured-logger';

/**
 * Prefer Express route templates (/employees/:id) to avoid unbounded cardinality.
 */
export function normalizeHttpRoute(
  routePath: string | undefined,
  pathname: string,
  baseUrl = '',
): string {
  if (routePath && routePath.length > 0 && !routePath.includes('*')) {
    const joined = `${baseUrl}${routePath.startsWith('/') ? routePath : `/${routePath}`}`;
    return joined.replace(/\/{2,}/g, '/') || '/';
  }
  return pathname
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi,
      ':id',
    )
    .replace(/\/\d+(?=\/|$)/g, '/:id');
}

@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();
  private httpRequestsTotal!: Counter<string>;
  private httpRequestDuration!: Histogram<string>;
  private initialized = false;

  onModuleInit(): void {
    if (!isMetricsEnabled() || this.initialized) return;
    this.registry.setDefaultLabels({ service: 'api' });
    collectDefaultMetrics({ register: this.registry });

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.initialized = true;
  }

  normalizeRoute(
    routePath: string | undefined,
    pathname: string,
    baseUrl = '',
  ): string {
    return normalizeHttpRoute(routePath, pathname, baseUrl);
  }

  observeHttp(input: {
    method: string;
    route: string;
    statusCode: number;
    durationMs: number;
  }): void {
    if (!this.initialized || !isMetricsEnabled()) return;
    const method = input.method.toUpperCase();
    const route = input.route || 'unmatched';
    const status = String(input.statusCode);
    this.httpRequestsTotal.inc({ method, route, status_code: status });
    this.httpRequestDuration.observe(
      { method, route, status_code: status },
      input.durationMs / 1000,
    );
  }

  async render(): Promise<string> {
    if (!isMetricsEnabled()) {
      return '# metrics disabled\n';
    }
    if (!this.initialized) {
      this.onModuleInit();
    }
    return this.registry.metrics();
  }

  contentType(): string {
    return this.registry.contentType;
  }
}
