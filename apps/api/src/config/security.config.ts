import { Logger } from '@nestjs/common';

const WEAK_SECRETS = new Set([
  'secret',
  'changeme',
  'change-me',
  'password',
  'jwt-secret',
  'dev-access-secret-change-me',
  'dev-refresh-secret-change-me',
]);

export const REFRESH_COOKIE_NAME = 'tsc_refresh';

export type SameSiteMode = 'lax' | 'strict' | 'none';

export type SecurityRuntimeConfig = {
  isProduction: boolean;
  corsOrigins: string[];
  refreshCookie: {
    name: string;
    httpOnly: true;
    secure: boolean;
    sameSite: SameSiteMode;
    path: string;
    maxAgeMs: number;
  };
  jsonBodyLimit: string;
};

function parseTtlMs(raw: string | undefined, fallback: string): number {
  const trimmed = (raw ?? fallback).trim();
  const match = /^(\d+)([smhd])?$/.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid TTL format: ${trimmed}`);
  }
  const amount = Number(match[1]);
  const unit = match[2] ?? 's';
  switch (unit) {
    case 's':
      return amount * 1000;
    case 'm':
      return amount * 60 * 1000;
    case 'h':
      return amount * 60 * 60 * 1000;
    case 'd':
      return amount * 60 * 60 * 24 * 1000;
    default:
      throw new Error(`Invalid TTL unit: ${trimmed}`);
  }
}

export function parseCorsOrigins(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter((origin) => origin.length > 0);
}

function isWeakSecret(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (WEAK_SECRETS.has(normalized)) return true;
  if (normalized.length < 32) return true;
  return false;
}

/**
 * Validate process env for security-critical settings.
 * Throws on production misconfiguration. Logs warnings in development.
 */
export function validateSecurityEnv(
  env: NodeJS.ProcessEnv = process.env,
): SecurityRuntimeConfig {
  const logger = new Logger('SecurityConfig');
  const isProduction = env.NODE_ENV === 'production';

  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const accessSecret = env.JWT_ACCESS_SECRET?.trim();
  const refreshSecret = env.JWT_REFRESH_SECRET?.trim();
  if (!accessSecret || !refreshSecret) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are required');
  }
  if (accessSecret === refreshSecret) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
  }

  if (isProduction) {
    if (isWeakSecret(accessSecret) || isWeakSecret(refreshSecret)) {
      throw new Error(
        'JWT secrets are too weak for production (min 32 chars; no known defaults)',
      );
    }
  } else if (isWeakSecret(accessSecret) || isWeakSecret(refreshSecret)) {
    logger.warn(
      'JWT secrets look weak/default. Acceptable only for local development.',
    );
  }

  const corsOrigins = parseCorsOrigins(env.CORS_ORIGINS);
  if (isProduction) {
    if (corsOrigins.length === 0) {
      throw new Error('CORS_ORIGINS must be set in production');
    }
    if (corsOrigins.some((o) => o === '*' || o.includes('*'))) {
      throw new Error('CORS_ORIGINS must not use wildcards in production');
    }
  } else if (corsOrigins.length === 0) {
    corsOrigins.push('http://localhost:3000');
  }

  const sameSiteRaw = (env.COOKIE_SAMESITE ?? 'none').trim().toLowerCase();
  const sameSite: SameSiteMode =
    sameSiteRaw === 'lax' || sameSiteRaw === 'strict' || sameSiteRaw === 'none'
      ? sameSiteRaw
      : 'none';

  // Cross-origin SPA (web:3000 → api:3001) needs SameSite=None + Secure.
  // Chromium treats http://localhost as a secure context for Secure cookies.
  const secure =
    env.COOKIE_SECURE === 'true' || isProduction || sameSite === 'none';

  if (sameSite === 'none' && !secure) {
    throw new Error('COOKIE_SAMESITE=none requires Secure cookies');
  }

  const maxAgeMs = parseTtlMs(env.JWT_REFRESH_TTL, '7d');

  return {
    isProduction,
    corsOrigins,
    refreshCookie: {
      name: REFRESH_COOKIE_NAME,
      httpOnly: true,
      secure,
      sameSite,
      path: '/auth',
      maxAgeMs,
    },
    jsonBodyLimit: env.JSON_BODY_LIMIT?.trim() || '1mb',
  };
}

export function isAllowedCorsOrigin(
  origin: string | undefined,
  allowed: string[],
): boolean {
  if (!origin) return false;
  const normalized = origin.trim().replace(/\/$/, '');
  return allowed.includes(normalized);
}
