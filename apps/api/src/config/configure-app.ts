import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import {
  json,
  urlencoded,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import helmet from 'helmet';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';
import { requestIdMiddleware } from '../observability/request-id.middleware';
import {
  isAllowedCorsOrigin,
  type SecurityRuntimeConfig,
  validateSecurityEnv,
} from './security.config';

/**
 * Shared Nest bootstrap (main + e2e). Applies CORS, cookies, helmet, pipes, filters.
 * Call with bodyParser:false when creating the Nest app.
 */
export function configureApp(
  app: INestApplication,
  options?: { security?: SecurityRuntimeConfig },
): SecurityRuntimeConfig {
  const security = options?.security ?? validateSecurityEnv(process.env);

  // Behind a single trusted reverse proxy / load balancer (see docs/production-infrastructure.md).
  // TRUST_PROXY=1 enables Express trust proxy hop count 1 for X-Forwarded-* / secure cookies / req.ip.
  const trustProxy = process.env.TRUST_PROXY?.trim();
  if (trustProxy === '1' || trustProxy?.toLowerCase() === 'true') {
    const httpAdapter = app.getHttpAdapter();
    const instance = httpAdapter.getInstance() as {
      set?: (k: string, v: unknown) => void;
    };
    instance.set?.('trust proxy', 1);
  }

  app.use(json({ limit: security.jsonBodyLimit }));
  app.use(urlencoded({ extended: true, limit: security.jsonBodyLimit }));

  app.use(
    helmet({
      contentSecurityPolicy: false, // API JSON; CSP owned by Next.js
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hsts: security.isProduction
        ? { maxAge: 15_552_000, includeSubDomains: true }
        : false,
    }),
  );

  app.use(cookieParser());
  app.use(requestIdMiddleware);

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (isAllowedCorsOrigin(origin, security.corsOrigins)) {
        callback(null, true);
        return;
      }
      // Do not throw — an Error here becomes a 500 via Nest exception handling.
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'Accept',
      'X-Company-Id',
      'X-Requested-With',
      'X-Request-Id',
    ],
    exposedHeaders: ['X-Request-Id'],
  });

  // CSRF-lite for cookie-authenticated auth mutations: Origin must be allowlisted when present.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const path = req.path || '';
    const isAuthMutation =
      req.method !== 'GET' &&
      req.method !== 'HEAD' &&
      req.method !== 'OPTIONS' &&
      (path === '/auth/login' ||
        path === '/auth/refresh' ||
        path === '/auth/logout');
    if (!isAuthMutation) {
      next();
      return;
    }
    const origin = req.headers.origin;
    if (typeof origin === 'string' && origin.length > 0) {
      if (!isAllowedCorsOrigin(origin, security.corsOrigins)) {
        res.status(403).json({ statusCode: 403, message: 'Forbidden origin' });
        return;
      }
    }
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(
    new AllExceptionsFilter(httpAdapterHost, security.isProduction),
  );

  return security;
}
