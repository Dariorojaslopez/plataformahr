import { INestApplication } from '@nestjs/common';
import {
  CompanyStatus,
  MembershipStatus,
  PrismaClient,
  RoleScope,
  UserStatus,
} from '@prisma/client';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadOptionalEnvFile } from './load-env';
import request from 'supertest';
import { App } from 'supertest/types';
import { PasswordHashingService } from '../src/auth/password-hashing.service';
import {
  COMPANY_BRANDING_AUDIT,
  LOGO_MAX_BYTES,
} from '../src/core/companies/branding/branding.constants';
import type { CompanyBrandingResponse } from '../src/core/companies/branding/branding.service';
import { createSecurityAwareE2eApp } from './e2e-app';

loadOptionalEnvFile(join(__dirname, '../.env'));

const MIN_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

type LoginBody = {
  accessToken: string;
  user: { id: string };
};

function asBranding(body: unknown): CompanyBrandingResponse {
  return body as CompanyBrandingResponse;
}

describe('Company branding (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let hasher: PasswordHashingService;
  let uploadsDir = '';
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  let companyAId = '';
  let companyBId = '';
  let adminAToken = '';
  let adminBToken = '';
  let collabToken = '';
  const password = `BrandPass-${suffix}!`;

  beforeAll(async () => {
    uploadsDir = mkdtempSync(join(tmpdir(), 'branding-e2e-'));
    process.env.COMPANY_UPLOADS_DIR = uploadsDir;

    prisma = new PrismaClient();
    hasher = new PasswordHashingService();
    const created = await createSecurityAwareE2eApp();
    app = created.app as INestApplication<App>;

    const companyA = await prisma.company.create({
      data: {
        name: `Brand A ${suffix}`,
        slug: `brand-a-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    const companyB = await prisma.company.create({
      data: {
        name: `Brand B ${suffix}`,
        slug: `brand-b-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    companyAId = companyA.id;
    companyBId = companyB.id;

    const passwordHash = await hasher.hash(password);
    const adminA = await prisma.user.create({
      data: {
        email: `branda-admin-${suffix}@example.com`,
        passwordHash,
        firstName: 'Admin',
        lastName: 'A',
        status: UserStatus.ACTIVE,
      },
    });
    const adminB = await prisma.user.create({
      data: {
        email: `brandb-admin-${suffix}@example.com`,
        passwordHash,
        firstName: 'Admin',
        lastName: 'B',
        status: UserStatus.ACTIVE,
      },
    });
    const collab = await prisma.user.create({
      data: {
        email: `branda-collab-${suffix}@example.com`,
        passwordHash,
        firstName: 'Collab',
        lastName: 'A',
        status: UserStatus.ACTIVE,
      },
    });

    const roleAdmin = await prisma.role.findUniqueOrThrow({
      where: {
        scope_code: { scope: RoleScope.COMPANY, code: 'CLIENT_ADMIN' },
      },
    });
    const roleCollab = await prisma.role.findUniqueOrThrow({
      where: {
        scope_code: { scope: RoleScope.COMPANY, code: 'COLLABORATOR' },
      },
    });

    for (const [userId, companyId, roleId] of [
      [adminA.id, companyA.id, roleAdmin.id],
      [adminB.id, companyB.id, roleAdmin.id],
      [collab.id, companyA.id, roleCollab.id],
    ] as const) {
      const membership = await prisma.companyMembership.create({
        data: { userId, companyId, status: MembershipStatus.ACTIVE },
      });
      await prisma.membershipRole.create({
        data: { membershipId: membership.id, roleId },
      });
    }

    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(201);
      return (res.body as LoginBody).accessToken;
    };

    adminAToken = await login(`branda-admin-${suffix}@example.com`);
    adminBToken = await login(`brandb-admin-${suffix}@example.com`);
    collabToken = await login(`branda-collab-${suffix}@example.com`);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
    rmSync(uploadsDir, { recursive: true, force: true });
  });

  it('returns defaults for a company without branding', async () => {
    const res = await request(app.getHttpServer())
      .get('/companies/current/branding')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .expect(200);

    const body = asBranding(res.body);
    expect(body.brandPrimaryColor).toBeNull();
    expect(body.hasLogo).toBe(false);
    expect(body.logoUpdatedAt).toBeNull();
    expect(body.name).toContain('Brand A');
    expect(JSON.stringify(body)).not.toMatch(
      /logoFileName|\/data\/|uploadsDir/,
    );
  });

  it('updates a valid brand color', async () => {
    const res = await request(app.getHttpServer())
      .patch('/companies/current/branding')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .send({ brandPrimaryColor: '#1a6b68' })
      .expect(200);

    const body = asBranding(res.body);
    expect(body.brandPrimaryColor).toBe('#1A6B68');
  });

  it('rejects an invalid brand color', async () => {
    await request(app.getHttpServer())
      .patch('/companies/current/branding')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .send({ brandPrimaryColor: 'url(https://evil)' })
      .expect(400);

    await request(app.getHttpServer())
      .patch('/companies/current/branding')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .send({ brandPrimaryColor: '#fff' })
      .expect(400);
  });

  it('uploads a valid PNG logo', async () => {
    const res = await request(app.getHttpServer())
      .post('/companies/current/branding/logo')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .attach('file', MIN_PNG, {
        filename: 'logo.png',
        contentType: 'image/png',
      })
      .expect(201);

    const body = asBranding(res.body);
    expect(body.hasLogo).toBe(true);
    expect(body.logoUpdatedAt).toBeTruthy();

    const logo = await request(app.getHttpServer())
      .get('/companies/current/branding/logo')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .buffer()
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200)
      .expect('Content-Type', /image\/png/);

    expect(Buffer.isBuffer(logo.body)).toBe(true);
    expect(
      (logo.body as Buffer).subarray(0, 8).equals(MIN_PNG.subarray(0, 8)),
    ).toBe(true);
  });

  it('rejects an invalid MIME type with 415', async () => {
    await request(app.getHttpServer())
      .post('/companies/current/branding/logo')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .attach('file', Buffer.from('not-an-image'), {
        filename: 'logo.png',
        contentType: 'image/png',
      })
      .expect(415);
  });

  it('rejects SVG even if named as png', async () => {
    await request(app.getHttpServer())
      .post('/companies/current/branding/logo')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .attach(
        'file',
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        ),
        { filename: 'logo.svg', contentType: 'image/svg+xml' },
      )
      .expect(415);
  });

  it('rejects an oversized file with 413', async () => {
    const oversized = Buffer.alloc(LOGO_MAX_BYTES + 16, 1);
    MIN_PNG.copy(oversized, 0, 0, MIN_PNG.length);

    await request(app.getHttpServer())
      .post('/companies/current/branding/logo')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .attach('file', oversized, {
        filename: 'huge.png',
        contentType: 'image/png',
      })
      .expect(413);
  });

  it('replaces the previous logo file', async () => {
    const before = await prisma.company.findUniqueOrThrow({
      where: { id: companyAId },
    });
    expect(before.logoFileName).toBeTruthy();

    const res = await request(app.getHttpServer())
      .post('/companies/current/branding/logo')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .attach('file', MIN_PNG, {
        filename: 'replacement.png',
        contentType: 'image/png',
      })
      .expect(201);

    const body = asBranding(res.body);
    expect(body.hasLogo).toBe(true);
    const after = await prisma.company.findUniqueOrThrow({
      where: { id: companyAId },
    });
    expect(after.logoFileName).toBeTruthy();
    expect(after.logoFileName).not.toBe(before.logoFileName);
    expect(after.logoFileName).not.toContain('replacement');
  });

  it('removes the logo and restores hasLogo=false', async () => {
    const res = await request(app.getHttpServer())
      .delete('/companies/current/branding/logo')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .expect(200);

    const body = asBranding(res.body);
    expect(body.hasLogo).toBe(false);
    expect(body.logoUpdatedAt).toBeNull();

    await request(app.getHttpServer())
      .get('/companies/current/branding/logo')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .expect(404);
  });

  it('keeps company A branding isolated from company B', async () => {
    await request(app.getHttpServer())
      .patch('/companies/current/branding')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .send({ brandPrimaryColor: '#112233' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/companies/current/branding')
      .set('Authorization', `Bearer ${adminBToken}`)
      .set('X-Company-Id', companyBId)
      .expect(200);

    const other = asBranding(res.body);
    expect(other.brandPrimaryColor).toBeNull();
    expect(other.hasLogo).toBe(false);
    await request(app.getHttpServer())
      .patch('/companies/current/branding')
      .set('Authorization', `Bearer ${collabToken}`)
      .set('X-Company-Id', companyAId)
      .send({ brandPrimaryColor: '#ABCDEF' })
      .expect(403);

    await request(app.getHttpServer())
      .get('/companies/current/branding')
      .set('Authorization', `Bearer ${collabToken}`)
      .set('X-Company-Id', companyAId)
      .expect(200);
  });

  it('rejects cross-tenant branding updates', async () => {
    await request(app.getHttpServer())
      .patch('/companies/current/branding')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyBId)
      .send({ brandPrimaryColor: '#445566' })
      .expect(403);
  });

  it('writes AuditLog rows without logo bytes', async () => {
    const logs = await prisma.auditLog.findMany({
      where: {
        companyId: companyAId,
        action: {
          in: [
            COMPANY_BRANDING_AUDIT.UPDATED,
            COMPANY_BRANDING_AUDIT.LOGO_REPLACED,
            COMPANY_BRANDING_AUDIT.LOGO_REMOVED,
          ],
        },
      },
    });
    expect(logs.length).toBeGreaterThanOrEqual(3);
    for (const log of logs) {
      const raw = JSON.stringify(log.metadata ?? {});
      expect(raw).not.toMatch(
        /iVBORw0KGgo|logoFileName|\/data\/company-uploads/,
      );
    }
  });

  it('keeps a historical company without branding configuration working', async () => {
    const legacy = await prisma.company.create({
      data: {
        name: `Legacy ${suffix}`,
        slug: `legacy-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    expect(legacy.brandPrimaryColor).toBeNull();
    expect(legacy.logoFileName).toBeNull();

    const passwordHash = await hasher.hash(password);
    const admin = await prisma.user.create({
      data: {
        email: `legacy-admin-${suffix}@example.com`,
        passwordHash,
        firstName: 'Legacy',
        lastName: 'Admin',
        status: UserStatus.ACTIVE,
      },
    });
    const roleAdmin = await prisma.role.findUniqueOrThrow({
      where: {
        scope_code: { scope: RoleScope.COMPANY, code: 'CLIENT_ADMIN' },
      },
    });
    const membership = await prisma.companyMembership.create({
      data: {
        userId: admin.id,
        companyId: legacy.id,
        status: MembershipStatus.ACTIVE,
      },
    });
    await prisma.membershipRole.create({
      data: { membershipId: membership.id, roleId: roleAdmin.id },
    });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `legacy-admin-${suffix}@example.com`, password })
      .expect(201);
    const token = (login.body as LoginBody).accessToken;

    const res = await request(app.getHttpServer())
      .get('/companies/current/branding')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Company-Id', legacy.id)
      .expect(200);

    const body = asBranding(res.body);
    expect(body.brandPrimaryColor).toBeNull();
    expect(body.hasLogo).toBe(false);
    expect(body.name).toBe(legacy.name);
  });
});
