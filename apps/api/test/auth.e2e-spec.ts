import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  CompanyStatus,
  MembershipStatus,
  PrismaClient,
  RoleScope,
  UserStatus,
} from '@prisma/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PasswordHashingService } from '../src/auth/password-hashing.service';
function loadEnvFile(filePath: string): void {
  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;
    const key = trimmed.slice(0, separatorIndex);
    const value = trimmed.slice(separatorIndex + 1);
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(join(__dirname, '../.env'));

type LoginBody = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    isPlatformOwner: boolean;
  };
  companies: Array<{ id: string; name: string; slug: string }>;
};

describe('Auth + tenant + RBAC (e2e)', () => {
  let app: INestApplication<App>;
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

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

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

  it('logs in successfully and omits passwordHash', async () => {
    const body = await loginAs(adminEmail, adminPassword);
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    expect(body.user.email).toBe(adminEmail);
    expect(body.user.isPlatformOwner).toBe(false);
    expect(body.companies).toEqual([
      expect.objectContaining({ id: companyId, slug: `auth-co-${suffix}` }),
    ]);
    expect(JSON.stringify(body)).not.toContain('passwordHash');
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

  it('refreshes tokens and rotates refresh token', async () => {
    const first = await loginAs(adminEmail, adminPassword);
    const refreshed = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(201);

    const body = refreshed.body as {
      accessToken: string;
      refreshToken: string;
    };
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    expect(body.refreshToken).not.toBe(first.refreshToken);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: body.refreshToken })
      .expect(201);
  });

  it('rejects access token used as refresh token', async () => {
    const session = await loginAs(adminEmail, adminPassword);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: session.accessToken })
      .expect(401);
  });

  it('logout revokes the refresh token', async () => {
    const session = await loginAs(adminEmail, adminPassword);
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(401);
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

  it('does not grant Platform Owner automatic tenant access without membership', async () => {
    const ownerSession = await loginAs(ownerEmail, ownerPassword);
    await request(app.getHttpServer())
      .get('/companies/current')
      .set('Authorization', `Bearer ${ownerSession.accessToken}`)
      .set('X-Company-Id', companyId)
      .expect(403);
  });
});
