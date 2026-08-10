import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service';
import { getSlowRequestMs, writeStructuredLog } from './structured-logger';

type RequestWithId = Request & { requestId?: string };

@Injectable()
export class HttpObservabilityInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<RequestWithId>();
    const res = http.getResponse<Response>();
    const started = Date.now();
    const method = req.method ?? 'GET';
    const pathname = (req.originalUrl ?? req.url ?? '/').split('?')[0] || '/';

    // Skip noisy probes from default request logs (still counted lightly below).
    const isProbe =
      pathname === '/health' ||
      pathname === '/ready' ||
      pathname === '/metrics';

    return next.handle().pipe(
      tap({
        next: () => {
          this.finish(req, res, method, pathname, started, isProbe);
        },
        error: () => {
          this.finish(req, res, method, pathname, started, isProbe);
        },
      }),
    );
  }

  private finish(
    req: RequestWithId,
    res: Response,
    method: string,
    pathname: string,
    started: number,
    isProbe: boolean,
  ): void {
    const durationMs = Date.now() - started;
    const statusCode = res.statusCode || 500;
    const routeLayer = req.route as { path?: unknown } | undefined;
    const routePath =
      typeof routeLayer?.path === 'string' ? routeLayer.path : undefined;
    const baseUrl = typeof req.baseUrl === 'string' ? req.baseUrl : '';
    const route = this.metrics.normalizeRoute(routePath, pathname, baseUrl);

    this.metrics.observeHttp({ method, route, statusCode, durationMs });

    if (isProbe && statusCode < 500) {
      return;
    }

    const slowMs = getSlowRequestMs();
    const level =
      statusCode >= 500 ? 'error' : durationMs >= slowMs ? 'warn' : 'info';

    writeStructuredLog({
      level,
      message: 'http_request',
      requestId: req.requestId,
      method,
      path: pathname,
      statusCode,
      durationMs,
      route,
    });
  }
}
