import type { Response } from 'express';
import type { SecurityRuntimeConfig } from './security.config';
import { REFRESH_COOKIE_NAME } from './security.config';

export function setRefreshCookie(
  res: Response,
  token: string,
  security: SecurityRuntimeConfig,
): void {
  const { refreshCookie } = security;
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: refreshCookie.secure,
    sameSite: refreshCookie.sameSite,
    path: refreshCookie.path,
    maxAge: refreshCookie.maxAgeMs,
  });
}

export function clearRefreshCookie(
  res: Response,
  security: SecurityRuntimeConfig,
): void {
  const { refreshCookie } = security;
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: refreshCookie.secure,
    sameSite: refreshCookie.sameSite,
    path: refreshCookie.path,
  });
}

export function readRefreshCookie(
  cookies: Record<string, string> | undefined,
): string | undefined {
  const value = cookies?.[REFRESH_COOKIE_NAME];
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }
  return value;
}
