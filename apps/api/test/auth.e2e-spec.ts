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
  user: {
    id: string;
    email: string;
    isPlatformOwner: boolean;
  };
  companies: Array<{ id: string; name: string; slug: string }>;
};

describe('Auth + tenant + RBAC (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let hasher: PasswordHashingService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  let companyId = '';
  let otherCompanyId = '';
  let adminUserId = '';
  let adminEmail = '';
  let adminPassword = '';
  let ownerEmail = '';
  let ownerPassword = '';
  let collaboratorEmail = '';
  let collaboratorPassword = '';

  beforeAll(async () => {
    prisma = new PrismaClient();
    hasher = new PasswordHashingService();

    const created = await createSecurityAwareE2eApp();
    app = created.app;

    adminEmail = `admin-${suffix}@example.com`;
    adminPassword = `AdminPass-${suffix}!`;
    ownerEmail = `owner-${suffix}@example.com`;
    ownerPassword = `OwnerPass-${suffix}!`;
    collaboratorEmail = `collab-${suffix}@example.com`;
    collaboratorPassword = `CollabPass-${suffix}!`;

    const company = await prisma.company.create({
      data: {
        name: `Auth Co ${suffix}`,
        slug: `auth-co-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    companyId = company.id;

    const otherCompany = await prisma.company.create({
      data: {
        name: `Other Co ${suffix}`,
        slug: `other-co-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    otherCompanyId = otherCompany.id;

    const adminHash = await hasher.hash(adminPassword);
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: adminHash,
        firstName: 'Admin',
        lastName: 'User',
        status: UserStatus.ACTIVE,
      },
    });
    adminUserId = admin.id;

    const membership = await prisma.companyMembership.create({
      data: {
        userId: admin.id,
        companyId: company.id,
        status: MembershipStatus.ACTIVE,
      },
    });

    const clientAdminRole = await prisma.role.findUniqueOrThrow({
      where: {
        scope_code: { scope: RoleScope.COMPANY, code: 'CLIENT_ADMIN' },
      },
    });
    await prisma.membershipRole.create({
      data: { membershipId: membership.id, roleId: clientAdminRole.id },
    });

    const ownerHash = await hasher.hash(ownerPassword);
    await prisma.user.create({
      data: {
        email: ownerEmail,
        passwordHash: ownerHash,
        firstName: 'Owner',
        lastName: 'User',
        status: UserStatus.ACTIVE,
        isPlatformOwner: true,
      },
    });

    const collabHash = await hasher.hash(collaboratorPassword);
    const collaborator = await prisma.user.create({
      data: {
        email: collaboratorEmail,
        passwordHash: collabHash,
        firstName: 'Collab',
        lastName: 'User',
        status: UserStatus.ACTIVE,
      },
    });
    const collabMembership = await prisma.companyMembership.create({
      data: {
        userId: collaborator.id,
        companyId: company.id,
        status: MembershipStatus.ACTIVE,
      },
    });
    // No roles => no permissions for collaborator permission-denial cases later.
    void collabMembership;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  async function loginAs(email: string, password: string): Promise<LoginBody> {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    return response.body as LoginBody;
  }

  it('logs in successfully with HttpOnly refresh cookie and no refresh in JSON', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(201);
    const body = response.body as LoginBody;
    expect(body.accessToken).toBeDefined();
    expect(
      (body as LoginBody & { refreshToken?: string }).refreshToken,
    ).toBeUndefined();
    expect(body.user.email).toBe(adminEmail);
    expect(body.user.isPlatformOwner).toBe(false);
    expect(body.companies).toEqual([
      expect.objectContaining({ id: companyId, slug: `auth-co-${suffix}` }),
    ]);
    expect(JSON.stringify(body)).not.toContain('passwordHash');

    const setCookie = response.headers['set-cookie'];
    const token = extractCookieValue(setCookie, REFRESH_COOKIE_NAME);
    expect(token).toBeTruthy();
    expect(token!.length).toBeGreaterThan(20);
    const flags = cookieFlags(setCookie, REFRESH_COOKIE_NAME);
    expect(flags.httpOnly).toBe(true);
    expect(flags.path).toBe('/auth');
    expect(flags.sameSite?.toLowerCase()).toBe('lax');
    expect(flags.secure).toBe(false);
  });

  it('recovers /auth/me from refresh cookie after the access token is gone', async () => {
    const agent = request.agent(app.getHttpServer());
    const loginRes = await agent
      .post('/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(201);
    const previousAccess = (loginRes.body as LoginBody).accessToken;
    expect(previousAccess).toBeDefined();

    const refreshed = await agent.post('/auth/refresh').expect(201);
    const body = refreshed.body as {
      accessToken: string;
      refreshToken?: string;
    };
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeUndefined();
    expect(
      cookieFlags(refreshed.headers['set-cookie'], REFRESH_COOKIE_NAME).path,
    ).toBe('/auth');

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .expect(200);
    expect((me.body as { email: string }).email).toBe(adminEmail);
  });

  it('rejects invalid credentials with a generic error', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, password: 'wrong-password' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `missing-${suffix}@example.com`, password: 'x' })
      .expect(401);
  });

  it('rejects INACTIVE, deleted and passwordless users', async () => {
    const inactiveEmail = `inactive-${suffix}@example.com`;
    await prisma.user.create({
      data: {
        email: inactiveEmail,
        passwordHash: await hasher.hash('InactivePass1!'),
        firstName: 'Inactive',
        lastName: 'User',
        status: UserStatus.INACTIVE,
      },
    });
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: inactiveEmail, password: 'InactivePass1!' })
      .expect(401);

    const deletedEmail = `deleted-${suffix}@example.com`;
    await prisma.user.create({
      data: {
        email: deletedEmail,
        passwordHash: await hasher.hash('DeletedPass1!'),
        firstName: 'Deleted',
        lastName: 'User',
        status: UserStatus.ACTIVE,
        deletedAt: new Date(),
      },
    });
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: deletedEmail, password: 'DeletedPass1!' })
      .expect(401);

    const ssoEmail = `sso-${suffix}@example.com`;
    await prisma.user.create({
      data: {
        email: ssoEmail,
        passwordHash: null,
        firstName: 'Sso',
        lastName: 'User',
        status: UserStatus.ACTIVE,
      },
    });
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: ssoEmail, password: 'anything' })
      .expect(401);
  });

  it('refreshes via cookie, rotates, and rejects replay of old cookie', async () => {
    const agent = request.agent(app.getHttpServer());
    const loginRes = await agent
      .post('/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(201);
    const oldRefresh = extractCookieValue(
      loginRes.headers['set-cookie'],
      REFRESH_COOKIE_NAME,
    );
    expect(oldRefresh).toBeTruthy();

    const refreshed = await agent.post('/auth/refresh').expect(201);
    const body = refreshed.body as {
      accessToken: string;
      refreshToken?: string;
    };
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeUndefined();
    const newRefresh = extractCookieValue(
      refreshed.headers['set-cookie'],
      REFRESH_COOKIE_NAME,
    );
    expect(newRefresh).toBeTruthy();
    expect(newRefresh).not.toBe(oldRefresh);

    // Rotated cookie works once more before any replay
    const refreshedAgain = await agent.post('/auth/refresh').expect(201);
    const newest = extractCookieValue(
      refreshedAgain.headers['set-cookie'],
      REFRESH_COOKIE_NAME,
    );
    expect(newest).toBeTruthy();

    // Replay of an older refresh → 401 and session revoke
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE_NAME}=${oldRefresh}`)
      .expect(401);

    // After reuse detection, even the latest cookie for that session fails
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE_NAME}=${newest}`)
      .expect(401);
  });

  it('rejects refresh without cookie', async () => {
    await request(app.getHttpServer()).post('/auth/refresh').expect(401);
  });

  it('rejects access token used as refresh cookie', async () => {
    const session = await loginAs(adminEmail, adminPassword);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE_NAME}=${session.accessToken}`)
      .expect(401);
  });

  it('logout revokes session and clears refresh cookie', async () => {
    const agent = request.agent(app.getHttpServer());
    const loginRes = await agent
      .post('/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(201);
    const accessToken = (loginRes.body as LoginBody).accessToken;

    const logoutRes = await agent
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);
    const cleared = extractCookieValue(
      logoutRes.headers['set-cookie'],
      REFRESH_COOKIE_NAME,
    );
    // Cleared cookie typically has empty value or Max-Age=0
    expect(cleared === null || cleared === '' || cleared === 'undefined').toBe(
      true,
    );

    await agent.post('/auth/refresh').expect(401);
  });

  it('returns 401 for protected routes without JWT', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
    await request(app.getHttpServer()).get('/companies/current').expect(401);
    await request(app.getHttpServer()).get('/platform/me').expect(401);
  });

  it('returns /auth/me for authenticated users', async () => {
    const session = await loginAs(adminEmail, adminPassword);
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);

    expect(me.body).toMatchObject({
      id: adminUserId,
      email: adminEmail,
      isPlatformOwner: false,
    });
    expect(JSON.stringify(me.body)).not.toContain('passwordHash');
  });

  it('allows CLIENT_ADMIN to read /companies/current with valid tenant', async () => {
    const session = await loginAs(adminEmail, adminPassword);
    const response = await request(app.getHttpServer())
      .get('/companies/current')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .set('X-Company-Id', companyId)
      .expect(200);

    expect(response.body).toMatchObject({
      id: companyId,
      slug: `auth-co-${suffix}`,
      status: 'ACTIVE',
      defaultLanguage: 'ES',
    });
  });

  it('rejects foreign company, inactive membership/company and deleted company', async () => {
    const session = await loginAs(adminEmail, adminPassword);

    await request(app.getHttpServer())
      .get('/companies/current')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .set('X-Company-Id', otherCompanyId)
      .expect(403);

    const inactiveMembershipUserEmail = `inactive-m-${suffix}@example.com`;
    const inactiveMembershipUser = await prisma.user.create({
      data: {
        email: inactiveMembershipUserEmail,
        passwordHash: await hasher.hash('InactiveMem1!'),
        firstName: 'Inactive',
        lastName: 'Member',
        status: UserStatus.ACTIVE,
      },
    });
    await prisma.companyMembership.create({
      data: {
        userId: inactiveMembershipUser.id,
        companyId,
        status: MembershipStatus.INACTIVE,
      },
    });
    const inactiveMembershipLogin = await loginAs(
      inactiveMembershipUserEmail,
      'InactiveMem1!',
    );
    await request(app.getHttpServer())
      .get('/companies/current')
      .set('Authorization', `Bearer ${inactiveMembershipLogin.accessToken}`)
      .set('X-Company-Id', companyId)
      .expect(403);

    const inactiveCompany = await prisma.company.create({
      data: {
        name: `Inactive Co ${suffix}`,
        slug: `inactive-co-${suffix}`,
        status: CompanyStatus.INACTIVE,
      },
    });
    await prisma.companyMembership.create({
      data: {
        userId: adminUserId,
        companyId: inactiveCompany.id,
        status: MembershipStatus.ACTIVE,
      },
    });
    await request(app.getHttpServer())
      .get('/companies/current')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .set('X-Company-Id', inactiveCompany.id)
      .expect(403);

    const deletedCompany = await prisma.company.create({
      data: {
        name: `Deleted Co ${suffix}`,
        slug: `deleted-co-${suffix}`,
        status: CompanyStatus.ACTIVE,
        deletedAt: new Date(),
      },
    });
    await prisma.companyMembership.create({
      data: {
        userId: adminUserId,
        companyId: deletedCompany.id,
        status: MembershipStatus.ACTIVE,
      },
    });
    await request(app.getHttpServer())
      .get('/companies/current')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .set('X-Company-Id', deletedCompany.id)
      .expect(403);
  });

  it('enforces permissions for tenant routes', async () => {
    const collabSession = await loginAs(
      collaboratorEmail,
      collaboratorPassword,
    );
    await request(app.getHttpServer())
      .get('/companies/current')
      .set('Authorization', `Bearer ${collabSession.accessToken}`)
      .set('X-Company-Id', companyId)
      .expect(403);

    const collabRole = await prisma.role.findUniqueOrThrow({
      where: {
        scope_code: { scope: RoleScope.COMPANY, code: 'COLLABORATOR' },
      },
    });
    const membership = await prisma.companyMembership.findUniqueOrThrow({
      where: {
        userId_companyId: {
          userId: (
            await prisma.user.findUniqueOrThrow({
              where: { email: collaboratorEmail },
            })
          ).id,
          companyId,
        },
      },
    });
    await prisma.membershipRole.create({
      data: { membershipId: membership.id, roleId: collabRole.id },
    });

    await request(app.getHttpServer())
      .get('/companies/current')
      .set('Authorization', `Bearer ${collabSession.accessToken}`)
      .set('X-Company-Id', companyId)
      .expect(200);
  });

  it('allows Platform Owner on /platform/me and blocks normal users', async () => {
    const ownerSession = await loginAs(ownerEmail, ownerPassword);
    const ownerMe = await request(app.getHttpServer())
      .get('/platform/me')
      .set('Authorization', `Bearer ${ownerSession.accessToken}`)
      .expect(200);
    expect(ownerMe.body).toMatchObject({
      email: ownerEmail,
      isPlatformOwner: true,
    });

    const adminSession = await loginAs(adminEmail, adminPassword);
    await request(app.getHttpServer())
      .get('/platform/me')
      .set('Authorization', `Bearer ${adminSession.accessToken}`)
      .expect(403);
  });

  it('lists active companies for Platform Owner and blocks normal users', async () => {
    const ownerSession = await loginAs(ownerEmail, ownerPassword);
    const listed = await request(app.getHttpServer())
      .get('/platform/companies')
      .set('Authorization', `Bearer ${ownerSession.accessToken}`)
      .expect(200);
    expect(Array.isArray(listed.body)).toBe(true);
    expect(
      (listed.body as { id: string; slug: string }[]).some(
        (c) => c.id === companyId,
      ),
    ).toBe(true);

    const adminSession = await loginAs(adminEmail, adminPassword);
    await request(app.getHttpServer())
      .get('/platform/companies')
      .set('Authorization', `Bearer ${adminSession.accessToken}`)
      .expect(403);
  });

  it('allows Platform Owner tenant access without membership for ACTIVE companies', async () => {
    const ownerSession = await loginAs(ownerEmail, ownerPassword);
    const current = await request(app.getHttpServer())
      .get('/companies/current')
      .set('Authorization', `Bearer ${ownerSession.accessToken}`)
      .set('X-Company-Id', companyId)
      .expect(200);
    expect(current.body).toMatchObject({
      id: companyId,
    });
  });

  it('rejects Platform Owner tenant access for inactive companies', async () => {
    const inactive = await prisma.company.create({
      data: {
        name: `Inactive Owner Co ${suffix}`,
        slug: `inactive-owner-${suffix}`,
        status: CompanyStatus.INACTIVE,
      },
    });
    const ownerSession = await loginAs(ownerEmail, ownerPassword);
    await request(app.getHttpServer())
      .get('/companies/current')
      .set('Authorization', `Bearer ${ownerSession.accessToken}`)
      .set('X-Company-Id', inactive.id)
      .expect(403);
  });
});
