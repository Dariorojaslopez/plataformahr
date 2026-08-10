import { type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/config/configure-app';
import { validateSecurityEnv } from '../src/config/security.config';

/**
 * Create Nest app with production-like security middleware (cookies, CORS, helmet).
 */
export async function createSecurityAwareE2eApp(options?: {
  overrideThrottle?: boolean;
}): Promise<{ app: INestApplication; moduleFixture: TestingModule }> {
  // Supertest speaks plain HTTP; Secure+SameSite=None cookies are not stored by agents.
  process.env.COOKIE_SAMESITE ??= 'lax';
  process.env.COOKIE_SECURE ??= 'false';
  const security = validateSecurityEnv(process.env);

  let builder = Test.createTestingModule({
    imports: [AppModule],
  });
  if (options?.overrideThrottle !== false) {
    builder = builder.overrideGuard(ThrottlerGuard).useValue({
      canActivate: () => true,
    });
  }

  const moduleFixture = await builder.compile();
  const app = moduleFixture.createNestApplication({ bodyParser: false });
  configureApp(app, { security });
  // configureApp already sets ValidationPipe; keep explicit for clarity in tests
  // that previously relied on local pipes — configureApp owns the pipe now.
  await app.init();
  return { app, moduleFixture };
}

export function extractCookieValue(
  setCookieHeader: string | string[] | undefined,
  name: string,
): string | null {
  const headers = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];
  for (const header of headers) {
    const match = new RegExp(`(?:^|,\\s*)${name}=([^;]+)`).exec(header);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function cookieFlags(
  setCookieHeader: string | string[] | undefined,
  name: string,
): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: string | null;
  path: string | null;
} {
  const headers = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];
  const line = headers.find((h) => h.startsWith(`${name}=`)) ?? '';
  return {
    httpOnly: /HttpOnly/i.test(line),
    secure: /Secure/i.test(line),
    sameSite: /SameSite=([^;]+)/i.exec(line)?.[1] ?? null,
    path: /Path=([^;]+)/i.exec(line)?.[1] ?? null,
  };
}
