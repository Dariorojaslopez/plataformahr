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

type LoginBody = {
  accessToken: string;
  refreshToken?: string;
};

describe('Security hardening (Fase 10)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let hasher: PasswordHashingService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let email = '';
  let password = '';
  let companyId = '';

  beforeAll(async () => {
    prisma = new PrismaClient();
    hasher = new PasswordHashingService();
    const created = await createSecurityAwareE2eApp();
    app = created.app;

    email = `sec-${suffix}@example.com`;
    password = `SecPass-${suffix}!`;
    const company = await prisma.company.create({
      data: {
        name: `Sec Co ${suffix}`,
        slug: `sec-co-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    companyId = company.id;
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hasher.hash(password),
        firstName: 'Sec',
        lastName: 'User',
        status: UserStatus.ACTIVE,
      },
    });
    const role = await prisma.role.findUniqueOrThrow({
      where: { scope_code: { scope: RoleScope.COMPANY, code: 'CLIENT_ADMIN' } },
    });
    const membership = await prisma.companyMembership.create({
      data: {
        userId: user.id,
        companyId,
        status: MembershipStatus.ACTIVE,
      },
    });
    await prisma.membershipRole.create({
      data: { membershipId: membership.id, roleId: role.id },
    });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('rejects forbidden Origin on auth login', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ email, password });
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ message: 'Forbidden origin' });
  });

  it('accepts allowlisted Origin on login', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email, password })
      .expect(201);
    const body = res.body as LoginBody;
    expect(body.refreshToken).toBeUndefined();
    expect(
      cookieFlags(res.headers['set-cookie'], REFRESH_COOKIE_NAME).httpOnly,
    ).toBe(true);
  });

  it('rejects unknown DTO fields (mass assignment / whitelist)', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email,
        password,
        isPlatformOwner: true,
        roles: ['CLIENT_ADMIN'],
      })
      .expect(400);
  });

  it('does not leak Prisma/stack in 500-style responses for bad UUID routes', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    const token = (login.body as LoginBody).accessToken;

    const res = await request(app.getHttpServer())
      .get('/companies/current')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Company-Id', 'not-a-uuid')
      .expect((r) => {
        expect([400, 404, 500]).toContain(r.status);
      });

    const text = JSON.stringify(res.body);
    expect(text.toLowerCase()).not.toContain('prisma');
    expect(text).not.toContain('at Object.');
    expect(text).not.toContain(password);
  });

  it('health returns minimal payload', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(JSON.stringify(res.body)).not.toContain('DATABASE');
  });

  it('ready returns ready without leaking internals', async () => {
    const res = await request(app.getHttpServer()).get('/ready').expect(200);
    expect(res.body).toEqual({ status: 'ready' });
    expect(JSON.stringify(res.body).toLowerCase()).not.toContain('postgres');
    expect(JSON.stringify(res.body)).not.toContain('DATABASE');
  });

  it('generates X-Request-Id when missing and preserves valid incoming', async () => {
    const generated = await request(app.getHttpServer())
      .get('/health')
      .expect(200);
    const id = generated.headers['x-request-id'];
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThanOrEqual(8);

    const preserved = await request(app.getHttpServer())
      .get('/health')
      .set('X-Request-Id', 'client-correlation-001')
      .expect(200);
    expect(preserved.headers['x-request-id']).toBe('client-correlation-001');

    const replaced = await request(app.getHttpServer())
      .get('/health')
      .set('X-Request-Id', 'bad')
      .expect(200);
    expect(replaced.headers['x-request-id']).not.toBe('bad');
    expect(
      String(replaced.headers['x-request-id']).length,
    ).toBeGreaterThanOrEqual(8);
  });

  it('exposes prometheus metrics without PII labels', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
    const res = await request(app.getHttpServer()).get('/metrics').expect(200);
    expect(res.text).toContain('http_requests_total');
    expect(res.text.toLowerCase()).not.toContain('authorization');
    expect(res.text.toLowerCase()).not.toContain('password');
    expect(res.text).not.toContain(email);
  });

  it('cross-tenant company header does not expose other company', async () => {
    const other = await prisma.company.create({
      data: {
        name: `Other Sec ${suffix}`,
        slug: `other-sec-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    await request(app.getHttpServer())
      .get('/companies/current')
      .set('Authorization', `Bearer ${(login.body as LoginBody).accessToken}`)
      .set('X-Company-Id', other.id)
      .expect(403);
  });

  it('refresh cookie value is not echoed in JSON bodies', async () => {
    const agent = request.agent(app.getHttpServer());
    const login = await agent
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    const cookieVal = extractCookieValue(
      login.headers['set-cookie'],
      REFRESH_COOKIE_NAME,
    );
    expect(cookieVal).toBeTruthy();
    const refreshed = await agent.post('/auth/refresh').expect(201);
    expect(JSON.stringify(refreshed.body)).not.toContain(cookieVal);
  });
});
