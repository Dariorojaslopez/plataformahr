import { INestApplication } from '@nestjs/common';
import {
  CompanyStatus,
  MembershipStatus,
  PrismaClient,
  RoleScope,
  UserStatus,
} from '@prisma/client';
import { join } from 'node:path';
import { loadOptionalEnvFile } from './load-env';
import request from 'supertest';
import { PasswordHashingService } from '../src/auth/password-hashing.service';
import { REFRESH_COOKIE_NAME } from '../src/config/security.config';
import {
  cookieFlags,
  createSecurityAwareE2eApp,
  extractCookieValue,
} from './e2e-app';

loadOptionalEnvFile(join(__dirname, '../.env'));

/**
 * Browser-visible Path behind a same-origin /api reverse proxy.
 * Nest still serves /auth/* (prefix stripped); the cookie Path must be /api/auth.
 */
const PUBLIC_COOKIE_PATH = '/api/auth';

describe('Auth refresh cookie path (reverse proxy)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let hasher: PasswordHashingService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let email = '';
  let password = '';

  const previousPath = process.env.COOKIE_PATH;
  const previousSecure = process.env.COOKIE_SECURE;
  const previousSameSite = process.env.COOKIE_SAMESITE;

  beforeAll(async () => {
    process.env.COOKIE_PATH = PUBLIC_COOKIE_PATH;
    process.env.COOKIE_SECURE = 'true';
    process.env.COOKIE_SAMESITE = 'lax';

    prisma = new PrismaClient();
    hasher = new PasswordHashingService();
    const created = await createSecurityAwareE2eApp();
    app = created.app;

    email = `cookie-path-${suffix}@example.com`;
    password = `CookiePath-${suffix}!`;
    const company = await prisma.company.create({
      data: {
        name: `Cookie Path Co ${suffix}`,
        slug: `cookie-path-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hasher.hash(password),
        firstName: 'Cookie',
        lastName: 'Path',
        status: UserStatus.ACTIVE,
      },
    });
    const role = await prisma.role.findUniqueOrThrow({
      where: { scope_code: { scope: RoleScope.COMPANY, code: 'CLIENT_ADMIN' } },
    });
    const membership = await prisma.companyMembership.create({
      data: {
        userId: user.id,
        companyId: company.id,
        status: MembershipStatus.ACTIVE,
      },
    });
    await prisma.membershipRole.create({
      data: { membershipId: membership.id, roleId: role.id },
    });
  });

  afterAll(async () => {
    if (previousPath === undefined) delete process.env.COOKIE_PATH;
    else process.env.COOKIE_PATH = previousPath;
    if (previousSecure === undefined) delete process.env.COOKIE_SECURE;
    else process.env.COOKIE_SECURE = previousSecure;
    if (previousSameSite === undefined) delete process.env.COOKIE_SAMESITE;
    else process.env.COOKIE_SAMESITE = previousSameSite;

    await app.close();
    await prisma.$disconnect();
  });

  it('sets, rotates and clears tsc_refresh on the public /api/auth path', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    const loginBody = login.body as {
      accessToken: string;
      refreshToken?: string;
    };
    expect(loginBody.accessToken).toBeDefined();
    expect(loginBody.refreshToken).toBeUndefined();

    const loginFlags = cookieFlags(
      login.headers['set-cookie'],
      REFRESH_COOKIE_NAME,
    );
    expect(loginFlags.httpOnly).toBe(true);
    expect(loginFlags.secure).toBe(true);
    expect(loginFlags.sameSite?.toLowerCase()).toBe('lax');
    expect(loginFlags.path).toBe(PUBLIC_COOKIE_PATH);

    const refreshToken = extractCookieValue(
      login.headers['set-cookie'],
      REFRESH_COOKIE_NAME,
    );
    expect(refreshToken).toBeTruthy();

    const refreshed = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE_NAME}=${refreshToken}`)
      .expect(201);
    const refreshBody = refreshed.body as {
      accessToken: string;
      refreshToken?: string;
    };
    expect(refreshBody.accessToken).toBeDefined();
    expect(refreshBody.refreshToken).toBeUndefined();

    const refreshFlags = cookieFlags(
      refreshed.headers['set-cookie'],
      REFRESH_COOKIE_NAME,
    );
    expect(refreshFlags.httpOnly).toBe(true);
    expect(refreshFlags.secure).toBe(true);
    expect(refreshFlags.sameSite?.toLowerCase()).toBe('lax');
    expect(refreshFlags.path).toBe(PUBLIC_COOKIE_PATH);

    const rotated = extractCookieValue(
      refreshed.headers['set-cookie'],
      REFRESH_COOKIE_NAME,
    );
    expect(rotated).toBeTruthy();
    expect(rotated).not.toBe(refreshToken);

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${refreshBody.accessToken}`)
      .expect(200);
    expect((me.body as { email: string }).email).toBe(email);

    const logout = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${refreshBody.accessToken}`)
      .expect(201);
    const logoutFlags = cookieFlags(
      logout.headers['set-cookie'],
      REFRESH_COOKIE_NAME,
    );
    expect(logoutFlags.path).toBe(PUBLIC_COOKIE_PATH);
    expect(logoutFlags.httpOnly).toBe(true);
    expect(logoutFlags.secure).toBe(true);
    expect(logoutFlags.sameSite?.toLowerCase()).toBe('lax');
  });
});
