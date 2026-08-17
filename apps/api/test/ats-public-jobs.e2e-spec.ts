import { type INestApplication } from '@nestjs/common';
import {
  CompanyStatus,
  MembershipStatus,
  PlatformModule,
  PrismaClient,
  RoleScope,
  UserStatus,
  VacancyRequestStatus,
  VacancyRequestType,
  VacancyStatus,
} from '@prisma/client';
import { join } from 'node:path';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PasswordHashingService } from '../src/auth/password-hashing.service';
import { createSecurityAwareE2eApp } from './e2e-app';
import { loadOptionalEnvFile } from './load-env';

loadOptionalEnvFile(join(__dirname, '../.env'));

describe('ATS public jobs (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const password = `PublicJobs-${suffix}!`;
  let companyAId = '';
  let companyBId = '';
  let vacancyAId = '';
  let vacancyBId = '';
  let adminToken = '';

  beforeAll(async () => {
    prisma = new PrismaClient();
    app = (await createSecurityAwareE2eApp()).app as INestApplication<App>;
    const hasher = new PasswordHashingService();
    const passwordHash = await hasher.hash(password);
    const role = await prisma.role.findUniqueOrThrow({
      where: {
        scope_code: { scope: RoleScope.COMPANY, code: 'CLIENT_ADMIN' },
      },
    });

    const createTenant = async (name: string, branded: boolean) => {
      const company = await prisma.company.create({
        data: {
          name,
          slug: `${name.toLowerCase().replaceAll(' ', '-')}-${suffix}`,
          status: CompanyStatus.ACTIVE,
          brandPrimaryColor: branded ? '#123456' : null,
        },
      });
      const area = await prisma.area.create({
        data: { companyId: company.id, name: `Engineering ${name}` },
      });
      const position = await prisma.position.create({
        data: {
          companyId: company.id,
          areaId: area.id,
          name: `Developer ${name}`,
          headcount: 1,
        },
      });
      const requester = await prisma.employee.create({
        data: {
          companyId: company.id,
          areaId: area.id,
          positionId: position.id,
          firstName: 'Requester',
          lastName: name,
          email: `requester-${name}-${suffix}@example.com`,
        },
      });
      const vacancyRequest = await prisma.vacancyRequest.create({
        data: {
          companyId: company.id,
          requestedByEmployeeId: requester.id,
          type: VacancyRequestType.EXISTING_POSITION,
          existingPositionId: position.id,
          requestedHeadcount: 1,
          justification: 'Approved public vacancy fixture',
          status: VacancyRequestStatus.APPROVED,
          submittedAt: new Date(),
          approvedAt: new Date(),
        },
      });
      const vacancy = await prisma.vacancy.create({
        data: {
          companyId: company.id,
          vacancyRequestId: vacancyRequest.id,
          positionId: position.id,
          areaId: area.id,
          title: `Developer ${name}`,
          description: `Public description ${name}`,
          headcount: 1,
          status: VacancyStatus.OPEN,
        },
      });
      return { company, vacancy };
    };

    const a = await createTenant(`Public A ${suffix}`, true);
    const b = await createTenant(`Public B ${suffix}`, false);
    companyAId = a.company.id;
    companyBId = b.company.id;
    vacancyAId = a.vacancy.id;
    vacancyBId = b.vacancy.id;

    const admin = await prisma.user.create({
      data: {
        email: `public-admin-${suffix}@example.com`,
        passwordHash,
        firstName: 'Public',
        lastName: 'Admin',
        status: UserStatus.ACTIVE,
      },
    });
    const membership = await prisma.companyMembership.create({
      data: {
        userId: admin.id,
        companyId: companyAId,
        status: MembershipStatus.ACTIVE,
      },
    });
    await prisma.membershipRole.create({
      data: { membershipId: membership.id, roleId: role.id },
    });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: admin.email, password })
      .expect(201);
    adminToken = (login.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const auth = () => ({
    Authorization: `Bearer ${adminToken}`,
    'X-Company-Id': companyAId,
  });
  const applicant = (email: string) => ({
    firstName: 'Ana',
    lastName: 'Public',
    email,
    phone: '+57 300 000 0000',
    documentType: 'CC',
    documentNumber: `DOC-${email.replace(/[^A-Za-z0-9]/g, '')}`.slice(0, 80),
  });

  it('is private by default, publishes explicitly and exposes only public DTO', async () => {
    await request(app.getHttpServer())
      .get('/public/jobs/not-published-id')
      .expect(404);

    const published = await request(app.getHttpServer())
      .post(`/ats/vacancies/${vacancyAId}/publish`)
      .set(auth())
      .expect(201);
    const publicId = (published.body as { publicId: string }).publicId;
    expect(publicId).toMatch(/^[A-Za-z0-9_-]{16}$/);

    const publicResponse = await request(app.getHttpServer())
      .get(`/public/jobs/${publicId}`)
      .expect(200);
    expect(publicResponse.body).toMatchObject({
      publicId,
      companyName: `Public A ${suffix}`,
      brandPrimaryColor: '#123456',
      hasLogo: false,
    });
    expect(publicResponse.body).not.toHaveProperty('companyId');
    expect(publicResponse.body).not.toHaveProperty('vacancyRequestId');
    expect(publicResponse.body).not.toHaveProperty('headcount');
  });

  it('creates a tenant-scoped candidate/application and blocks duplicates', async () => {
    const vacancy = await prisma.vacancy.findUniqueOrThrow({
      where: { id: vacancyAId },
    });
    const body = applicant(`same-${suffix}@example.com`);

    await request(app.getHttpServer())
      .post(`/public/jobs/${vacancy.publicId}/apply`)
      .send(body)
      .expect(201, { ok: true });
    await request(app.getHttpServer())
      .post(`/public/jobs/${vacancy.publicId}/apply`)
      .send(body)
      .expect(409)
      .expect(({ body: responseBody }) => {
        expect((responseBody as { message: string }).message).toBe(
          'Ya existe una postulación para esta vacante.',
        );
      });

    const candidate = await prisma.candidate.findUniqueOrThrow({
      where: {
        companyId_email: { companyId: companyAId, email: body.email },
      },
    });
    expect(
      await prisma.application.count({
        where: {
          companyId: companyAId,
          candidateId: candidate.id,
          vacancyId: vacancyAId,
        },
      }),
    ).toBe(1);
    expect(
      await prisma.applicationStageHistory.findFirst({
        where: { companyId: companyAId, changedByUserId: null },
      }),
    ).not.toBeNull();
  });

  it('rejects arbitrary document types and public companyId fields', async () => {
    const vacancy = await prisma.vacancy.findUniqueOrThrow({
      where: { id: vacancyAId },
    });
    await request(app.getHttpServer())
      .post(`/public/jobs/${vacancy.publicId}/apply`)
      .send({
        ...applicant(`invalid-${suffix}@example.com`),
        documentType: 'OTHER',
      })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/public/jobs/${vacancy.publicId}/apply`)
      .send({
        ...applicant(`company-${suffix}@example.com`),
        companyId: companyBId,
      })
      .expect(400);
  });

  it('keeps candidates isolated between companies', async () => {
    const publicIdB = `B${suffix.replace(/[^A-Za-z0-9]/g, '')}`
      .padEnd(16, '0')
      .slice(0, 16);
    await prisma.vacancy.update({
      where: { id: vacancyBId },
      data: { publicId: publicIdB, publishedAt: new Date() },
    });
    const email = `tenant-isolation-${suffix}@example.com`;
    const bodyA = applicant(email);
    const vacancyA = await prisma.vacancy.findUniqueOrThrow({
      where: { id: vacancyAId },
    });
    await request(app.getHttpServer())
      .post(`/public/jobs/${vacancyA.publicId}/apply`)
      .send(bodyA)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/public/jobs/${publicIdB}/apply`)
      .send(bodyA)
      .expect(201);

    expect(await prisma.candidate.count({ where: { email } })).toBe(2);
    expect(
      await prisma.application.count({
        where: { vacancyId: vacancyBId, companyId: companyBId },
      }),
    ).toBe(1);
  });

  it('unpublishes without deleting history and republishes with stable publicId', async () => {
    const before = await prisma.vacancy.findUniqueOrThrow({
      where: { id: vacancyAId },
    });
    const applicationsBefore = await prisma.application.count({
      where: { vacancyId: vacancyAId },
    });
    await request(app.getHttpServer())
      .post(`/ats/vacancies/${vacancyAId}/unpublish`)
      .set(auth())
      .expect(201);
    await request(app.getHttpServer())
      .get(`/public/jobs/${before.publicId}`)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/public/jobs/${before.publicId}/apply`)
      .send(applicant(`blocked-${suffix}@example.com`))
      .expect(404);
    expect(
      await prisma.application.count({ where: { vacancyId: vacancyAId } }),
    ).toBe(applicationsBefore);

    const republished = await request(app.getHttpServer())
      .post(`/ats/vacancies/${vacancyAId}/publish`)
      .set(auth())
      .expect(201);
    expect((republished.body as { publicId: string }).publicId).toBe(
      before.publicId,
    );
    expect(
      await prisma.auditLog.count({
        where: {
          companyId: companyAId,
          action: {
            in: [
              'VACANCY_PUBLISHED',
              'VACANCY_UNPUBLISHED',
              'PUBLIC_APPLICATION_CREATED',
            ],
          },
        },
      }),
    ).toBeGreaterThanOrEqual(3);
  });

  it('temporarily disables public jobs when the company ATS module is off', async () => {
    const vacancy = await prisma.vacancy.findUniqueOrThrow({
      where: { id: vacancyAId },
    });
    const applicationsBefore = await prisma.application.count({
      where: { vacancyId: vacancyAId },
    });
    await prisma.companyModule.upsert({
      where: {
        companyId_module: {
          companyId: companyAId,
          module: PlatformModule.ATS,
        },
      },
      create: {
        companyId: companyAId,
        module: PlatformModule.ATS,
        enabled: false,
      },
      update: { enabled: false },
    });

    await request(app.getHttpServer())
      .get(`/public/jobs/${vacancy.publicId}`)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/public/jobs/${vacancy.publicId}/apply`)
      .send(applicant(`module-off-${suffix}@example.com`))
      .expect(404);
    expect(
      await prisma.application.count({ where: { vacancyId: vacancyAId } }),
    ).toBe(applicationsBefore);

    await prisma.companyModule.update({
      where: {
        companyId_module: {
          companyId: companyAId,
          module: PlatformModule.ATS,
        },
      },
      data: { enabled: true },
    });
    await request(app.getHttpServer())
      .get(`/public/jobs/${vacancy.publicId}`)
      .expect(200);
  });
});
