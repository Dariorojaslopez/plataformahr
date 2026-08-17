import { type INestApplication } from '@nestjs/common';
import {
  CompanyStatus,
  PrismaClient,
  RoleScope,
  UserStatus,
} from '@prisma/client';
import { join } from 'node:path';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PasswordHashingService } from '../src/auth/password-hashing.service';
import { createSecurityAwareE2eApp } from './e2e-app';
import { loadOptionalEnvFile } from './load-env';

loadOptionalEnvFile(join(__dirname, '../.env'));

describe('Platform company administration (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const ownerPassword = `Owner-${suffix}!`;
  const normalPassword = `Normal-${suffix}!`;
  let ownerToken = '';
  let normalToken = '';
  let ownerId = '';

  beforeAll(async () => {
    prisma = new PrismaClient();
    app = (await createSecurityAwareE2eApp()).app as INestApplication<App>;
    const hasher = new PasswordHashingService();
    const [owner, normal] = await Promise.all([
      prisma.user.create({
        data: {
          email: `platform-owner-${suffix}@example.com`,
          passwordHash: await hasher.hash(ownerPassword),
          firstName: 'Platform',
          lastName: 'Owner',
          status: UserStatus.ACTIVE,
          isPlatformOwner: true,
        },
      }),
      prisma.user.create({
        data: {
          email: `platform-normal-${suffix}@example.com`,
          passwordHash: await hasher.hash(normalPassword),
          firstName: 'Normal',
          lastName: 'User',
          status: UserStatus.ACTIVE,
        },
      }),
    ]);
    const login = async (email: string, password: string) => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(201);
      return (response.body as { accessToken: string }).accessToken;
    };
    ownerToken = await login(owner.email, ownerPassword);
    ownerId = owner.id;
    normalToken = await login(normal.email, normalPassword);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  it('blocks non-platform users from global administration', async () => {
    await request(app.getHttpServer())
      .get('/platform/admin/companies')
      .set(bearer(normalToken))
      .expect(403);
    await request(app.getHttpServer())
      .get('/platform/admin/owners')
      .set(bearer(normalToken))
      .expect(403);
  });

  it('manages platform owners and temporary password resets safely', async () => {
    const created = await request(app.getHttpServer())
      .post('/platform/admin/owners')
      .set(bearer(ownerToken))
      .send({
        firstName: 'Second',
        lastName: 'Owner',
        email: `second-owner-${suffix}@example.com`,
      })
      .expect(201);
    const body = created.body as {
      owner: {
        id: string;
        email: string;
        mustChangePassword: boolean;
      };
      temporaryPassword: string;
    };
    expect(body.owner.mustChangePassword).toBe(true);
    expect(body.temporaryPassword).toHaveLength(24);

    const listed = await request(app.getHttpServer())
      .get('/platform/admin/owners')
      .set(bearer(ownerToken))
      .expect(200);
    expect(
      (listed.body as Array<{ id: string }>).some(
        ({ id }) => id === body.owner.id,
      ),
    ).toBe(true);

    const updatedEmail = `updated-owner-${suffix}@example.com`;
    await request(app.getHttpServer())
      .patch(`/platform/admin/owners/${body.owner.id}`)
      .set(bearer(ownerToken))
      .send({
        firstName: 'Updated',
        email: updatedEmail,
      })
      .expect(200);

    const reset = await request(app.getHttpServer())
      .post(`/platform/admin/owners/${body.owner.id}/reset-password`)
      .set(bearer(ownerToken))
      .expect(201);
    const resetPassword = (reset.body as { temporaryPassword: string })
      .temporaryPassword;
    expect(resetPassword).toHaveLength(24);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: updatedEmail, password: body.temporaryPassword })
      .expect(401);
    const resetLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: updatedEmail, password: resetPassword })
      .expect(201);
    expect(
      (resetLogin.body as { user: { mustChangePassword: boolean } }).user
        .mustChangePassword,
    ).toBe(true);

    await request(app.getHttpServer())
      .patch(`/platform/admin/owners/${ownerId}`)
      .set(bearer(ownerToken))
      .send({ status: UserStatus.BLOCKED })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/platform/admin/owners/${ownerId}/reset-password`)
      .set(bearer(ownerToken))
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/platform/admin/owners/${body.owner.id}`)
      .set(bearer(ownerToken))
      .send({ status: UserStatus.BLOCKED })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/platform/admin/owners/${body.owner.id}`)
      .set(bearer(ownerToken))
      .send({ status: UserStatus.ACTIVE, isPlatformOwner: false })
      .expect(200);
    expect(
      await prisma.user.count({
        where: { id: body.owner.id, isPlatformOwner: true },
      }),
    ).toBe(0);

    const logs = await prisma.auditLog.findMany({
      where: {
        entityId: body.owner.id,
        action: { startsWith: 'PLATFORM_OWNER_' },
      },
    });
    expect(logs.map(({ action }) => action)).toEqual(
      expect.arrayContaining([
        'PLATFORM_OWNER_CREATED',
        'PLATFORM_OWNER_UPDATED',
        'PLATFORM_OWNER_PASSWORD_RESET',
      ]),
    );
    expect(JSON.stringify(logs)).not.toContain(body.temporaryPassword);
    expect(JSON.stringify(logs)).not.toContain(resetPassword);
  });

  it('creates a company, initial admin and one-time temporary password', async () => {
    const created = await request(app.getHttpServer())
      .post('/platform/admin/companies')
      .set(bearer(ownerToken))
      .send({
        name: `Managed ${suffix}`,
        legalName: `Managed Legal ${suffix}`,
        slug: `managed-${suffix}`,
        adminFirstName: 'Tenant',
        adminLastName: 'Administrator',
        adminEmail: `tenant-admin-${suffix}@example.com`,
        enabledModules: ['ORGANIZATION'],
        enabledFeatures: ['organization.employees'],
      })
      .expect(201);

    const body = created.body as {
      company: { id: string; status: CompanyStatus };
      initialAdmin: { id: string; email: string };
      temporaryPassword: string;
    };
    expect(body.company.status).toBe(CompanyStatus.ACTIVE);
    expect(body.temporaryPassword).toHaveLength(24);

    const admin = await prisma.user.findUniqueOrThrow({
      where: { id: body.initialAdmin.id },
    });
    expect(admin.mustChangePassword).toBe(true);
    expect(admin.isPlatformOwner).toBe(false);
    const membership = await prisma.companyMembership.findUniqueOrThrow({
      where: {
        userId_companyId: {
          userId: admin.id,
          companyId: body.company.id,
        },
      },
      include: { roles: { include: { role: true } } },
    });
    expect(membership.roles.map(({ role }) => role.code)).toContain(
      'CLIENT_ADMIN',
    );

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: body.initialAdmin.email,
        password: body.temporaryPassword,
      })
      .expect(201);
    const initialToken = (login.body as { accessToken: string }).accessToken;
    expect(
      (login.body as { user: { mustChangePassword: boolean } }).user
        .mustChangePassword,
    ).toBe(true);

    await request(app.getHttpServer())
      .get('/companies/current')
      .set({
        ...bearer(initialToken),
        'X-Company-Id': body.company.id,
      })
      .expect(403);

    const changed = await request(app.getHttpServer())
      .post('/auth/change-password')
      .set(bearer(initialToken))
      .send({
        currentPassword: body.temporaryPassword,
        newPassword: `Changed-${suffix}-Password!`,
      })
      .expect(201);
    const changedToken = (changed.body as { accessToken: string }).accessToken;
    expect(
      (changed.body as { user: { mustChangePassword: boolean } }).user
        .mustChangePassword,
    ).toBe(false);
    await request(app.getHttpServer())
      .get('/companies/current')
      .set({
        ...bearer(changedToken),
        'X-Company-Id': body.company.id,
      })
      .expect(200);

    await request(app.getHttpServer())
      .get('/ats/vacancies')
      .set({
        ...bearer(changedToken),
        'X-Company-Id': body.company.id,
      })
      .expect(403);
    await request(app.getHttpServer())
      .put(`/platform/admin/companies/${body.company.id}/features`)
      .set(bearer(ownerToken))
      .send({
        enabledModules: ['ORGANIZATION', 'ATS'],
        enabledFeatures: ['organization.employees', 'ats.vacancies'],
      })
      .expect(200);
    const access = await request(app.getHttpServer())
      .get('/companies/current/features')
      .set({
        ...bearer(changedToken),
        'X-Company-Id': body.company.id,
      })
      .expect(200);
    expect(
      (access.body as { enabledModules: string[] }).enabledModules,
    ).toEqual(expect.arrayContaining(['ORGANIZATION', 'ATS']));
    await request(app.getHttpServer())
      .get('/ats/vacancies')
      .set({
        ...bearer(changedToken),
        'X-Company-Id': body.company.id,
      })
      .expect(200);

    const ownerAccess = await request(app.getHttpServer())
      .post(`/platform/admin/companies/${body.company.id}/access`)
      .set(bearer(ownerToken))
      .expect(201);
    expect((ownerAccess.body as { id: string }).id).toBe(body.company.id);
    await request(app.getHttpServer())
      .get('/companies/current')
      .set({
        ...bearer(ownerToken),
        'X-Company-Id': body.company.id,
      })
      .expect(200);

    const owner = await prisma.user.findFirstOrThrow({
      where: { email: `platform-owner-${suffix}@example.com` },
    });
    const ownerMembership = await prisma.companyMembership.findUniqueOrThrow({
      where: {
        userId_companyId: {
          userId: owner.id,
          companyId: body.company.id,
        },
      },
      include: { roles: { include: { role: true } } },
    });
    expect(ownerMembership.roles.map(({ role }) => role.code)).toContain(
      'CLIENT_ADMIN',
    );

    const logs = await prisma.auditLog.findMany({
      where: { companyId: body.company.id },
    });
    expect(logs.map(({ action }) => action)).toEqual(
      expect.arrayContaining([
        'PLATFORM_COMPANY_CREATED',
        'PLATFORM_COMPANY_FEATURES_UPDATED',
        'PLATFORM_TENANT_ADMIN_ACCESS_GRANTED',
      ]),
    );
    expect(JSON.stringify(logs)).not.toContain(body.temporaryPassword);
    expect(
      await prisma.auditLog.count({
        where: {
          userId: admin.id,
          action: 'AUTH_PASSWORD_CHANGED',
        },
      }),
    ).toBe(1);

    await request(app.getHttpServer())
      .patch(`/platform/admin/companies/${body.company.id}/status`)
      .set(bearer(ownerToken))
      .send({ status: CompanyStatus.SUSPENDED })
      .expect(200);
    await request(app.getHttpServer())
      .get('/companies/current')
      .set({
        ...bearer(ownerToken),
        'X-Company-Id': body.company.id,
      })
      .expect(403);
  });

  it('lists managed companies and validates duplicate provisioning', async () => {
    const listed = await request(app.getHttpServer())
      .get('/platform/admin/companies')
      .set(bearer(ownerToken))
      .expect(200);
    expect(
      (listed.body as Array<{ slug: string }>).some(
        ({ slug }) => slug === `managed-${suffix}`,
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .post('/platform/admin/companies')
      .set(bearer(ownerToken))
      .send({
        name: 'Duplicate',
        slug: `managed-${suffix}`,
        adminFirstName: 'Other',
        adminLastName: 'Admin',
        adminEmail: `other-${suffix}@example.com`,
        enabledModules: ['ATS'],
        enabledFeatures: ['ats.vacancies'],
      })
      .expect(409);

    expect(
      await prisma.role.count({
        where: { scope: RoleScope.COMPANY, code: 'CLIENT_ADMIN' },
      }),
    ).toBe(1);
  });
});
