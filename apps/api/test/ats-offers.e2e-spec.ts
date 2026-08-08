import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  ApplicationStage,
  ApplicationStatus,
  CandidateStatus,
  CompanyStatus,
  InterviewQuestionType,
  InterviewType,
  JobOfferStatus,
  MembershipStatus,
  PrismaClient,
  RoleScope,
  SalaryPeriod,
  UserStatus,
  VacancyRequestStatus,
  VacancyRequestType,
  VacancyStatus,
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
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(join(__dirname, '../.env'));

describe('ATS job offers (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let hasher: PasswordHashingService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const password = `OfferPass-${suffix}!`;

  let companyAId = '';
  let companyBId = '';
  let areaAId = '';
  let positionAId = '';
  let employeeAId = '';
  let interviewerEmployeeId = '';
  let leaderEmployeeId = '';
  let vacancyId = '';

  let applicationId = '';
  let candidateEmail = '';
  let offerId = '';
  let vacancyFilledBeforeAccept = 0;

  let adminToken = '';
  let recruiterToken = '';
  let leaderToken = '';
  let collaboratorToken = '';
  let adminBToken = '';

  const offerBody = (overrides: Record<string, unknown> = {}) => ({
    positionTitle: `Senior Dev ${suffix}`,
    salaryAmount: '4500000.00',
    salaryCurrency: 'COP',
    salaryPeriod: SalaryPeriod.MONTHLY,
    ...overrides,
  });

  const auth = (token: string, companyId = companyAId) => ({
    Authorization: `Bearer ${token}`,
    'X-Company-Id': companyId,
  });

  const login = async (email: string) => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    return (res.body as { accessToken: string }).accessToken;
  };

  const createApplication = async (tag: string) => {
    const candidate = await prisma.candidate.create({
      data: {
        companyId: companyAId,
        firstName: 'Cand',
        lastName: tag,
        email: `offer-cand-${tag}-${suffix}@example.com`,
      },
    });
    const application = await prisma.application.create({
      data: {
        companyId: companyAId,
        candidateId: candidate.id,
        vacancyId,
        stage: ApplicationStage.CONTACTED,
        status: ApplicationStatus.ACTIVE,
      },
    });
    return {
      applicationId: application.id,
      candidateId: candidate.id,
      candidateEmail: candidate.email,
    };
  };

  const startInterview = async (appId: string) => {
    const created = await request(app.getHttpServer())
      .post(`/ats/applications/${appId}/interviews`)
      .set(auth(recruiterToken))
      .send({
        type: InterviewType.HR,
        scheduledAt: new Date().toISOString(),
        interviewerEmployeeIds: [interviewerEmployeeId, leaderEmployeeId],
      })
      .expect(201);
    const interviewId = (created.body as { id: string }).id;
    await request(app.getHttpServer())
      .post(`/ats/interviews/${interviewId}/start`)
      .set(auth(recruiterToken))
      .expect(201);
    return interviewId;
  };

  const completeInterviewWithAnswers = async (appId: string) => {
    const template = await request(app.getHttpServer())
      .post('/ats/interview-form-templates')
      .set(auth(recruiterToken))
      .send({
        name: `Offer Form ${appId.slice(0, 8)} ${suffix}`,
        type: InterviewType.TECHNICAL,
        questions: [
          {
            text: 'Strengths',
            type: InterviewQuestionType.TEXT,
            required: true,
            order: 0,
          },
          {
            text: 'Rating',
            type: InterviewQuestionType.RATING,
            required: true,
            order: 1,
          },
        ],
      })
      .expect(201);

    const interviewRes = await request(app.getHttpServer())
      .post(`/ats/applications/${appId}/interviews`)
      .set(auth(recruiterToken))
      .send({
        type: InterviewType.TECHNICAL,
        scheduledAt: new Date().toISOString(),
        interviewerEmployeeIds: [leaderEmployeeId],
        templateId: (template.body as { id: string }).id,
      })
      .expect(201);
    const interviewId = (interviewRes.body as { id: string }).id;
    const questions = (
      interviewRes.body as {
        questions: { id: string; type: InterviewQuestionType }[];
      }
    ).questions;

    await request(app.getHttpServer())
      .post(`/ats/interviews/${interviewId}/start`)
      .set(auth(recruiterToken))
      .expect(201);

    await request(app.getHttpServer())
      .put(`/ats/interviews/${interviewId}/questions/${questions[0].id}/answer`)
      .set(auth(leaderToken))
      .send({ answerText: 'Strong communicator' })
      .expect(200);

    await request(app.getHttpServer())
      .put(`/ats/interviews/${interviewId}/questions/${questions[1].id}/answer`)
      .set(auth(leaderToken))
      .send({ rating: 5 })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/ats/interviews/${interviewId}/complete`)
      .set(auth(recruiterToken))
      .expect(201);

    return interviewId;
  };

  const createSentOffer = async (tag: string) => {
    const seeded = await createApplication(tag);
    await startInterview(seeded.applicationId);
    await completeInterviewWithAnswers(seeded.applicationId);
    const created = await request(app.getHttpServer())
      .post(`/ats/applications/${seeded.applicationId}/offer`)
      .set(auth(recruiterToken))
      .send(offerBody({ positionTitle: `Offer ${tag} ${suffix}` }))
      .expect(201);
    const id = (created.body as { id: string }).id;
    const sent = await request(app.getHttpServer())
      .post(`/ats/offers/${id}/send`)
      .set(auth(recruiterToken))
      .expect(201);
    return {
      ...seeded,
      offerId: id,
      offer: sent.body as { status: string; applicationId: string },
    };
  };

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

    const companyA = await prisma.company.create({
      data: {
        name: `Offer A ${suffix}`,
        slug: `offer-a-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    const companyB = await prisma.company.create({
      data: {
        name: `Offer B ${suffix}`,
        slug: `offer-b-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    companyAId = companyA.id;
    companyBId = companyB.id;

    const bu = await prisma.businessUnit.create({
      data: { companyId: companyAId, name: `Offer BU ${suffix}` },
    });
    const areaA = await prisma.area.create({
      data: {
        companyId: companyAId,
        businessUnitId: bu.id,
        name: `Offer Area ${suffix}`,
      },
    });
    areaAId = areaA.id;

    const jobLevel = await prisma.jobLevel.create({
      data: {
        companyId: companyAId,
        name: `Offer JL ${suffix}`,
        rank: 1000 + Math.floor(Math.random() * 1000),
      },
    });

    const positionA = await prisma.position.create({
      data: {
        companyId: companyAId,
        areaId: areaAId,
        jobLevelId: jobLevel.id,
        name: `Offer Role ${suffix}`,
        headcount: 5,
      },
    });
    positionAId = positionA.id;

    const offerPermissions = [
      {
        code: 'ats.offer.read',
        name: 'Read job offers',
        description: 'View job offers for applications',
      },
      {
        code: 'ats.offer.manage',
        name: 'Manage job offers',
        description: 'Create, update, send and withdraw job offers',
      },
      {
        code: 'ats.offer.respond',
        name: 'Respond to job offers',
        description:
          'Administratively register candidate acceptance or rejection of offers',
      },
    ] as const;

    const permissionIds = new Map<string, string>();
    for (const permission of offerPermissions) {
      const saved = await prisma.permission.upsert({
        where: { code: permission.code },
        create: {
          code: permission.code,
          name: permission.name,
          description: permission.description,
        },
        update: {
          name: permission.name,
          description: permission.description,
        },
      });
      permissionIds.set(permission.code, saved.id);
    }

    const offerPermissionByRole: Record<string, string[]> = {
      CLIENT_ADMIN: ['ats.offer.read', 'ats.offer.manage', 'ats.offer.respond'],
      RECRUITER: ['ats.offer.read', 'ats.offer.manage', 'ats.offer.respond'],
      LEADER: ['ats.offer.read'],
    };

    for (const [roleCode, codes] of Object.entries(offerPermissionByRole)) {
      const role = await prisma.role.findUniqueOrThrow({
        where: { scope_code: { scope: RoleScope.COMPANY, code: roleCode } },
      });
      for (const code of codes) {
        const permissionId = permissionIds.get(code)!;
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId,
            },
          },
          create: { roleId: role.id, permissionId },
          update: {},
        });
      }
    }

    const hash = await hasher.hash(password);
    const createUser = async (
      email: string,
      roleCode: string,
      companyId: string,
    ) => {
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash: hash,
          firstName: 'User',
          lastName: roleCode,
          status: UserStatus.ACTIVE,
        },
      });
      const role = await prisma.role.findUniqueOrThrow({
        where: { scope_code: { scope: RoleScope.COMPANY, code: roleCode } },
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
      return user;
    };

    const admin = await createUser(
      `offer-admin-${suffix}@example.com`,
      'CLIENT_ADMIN',
      companyAId,
    );
    await createUser(
      `offer-recruiter-${suffix}@example.com`,
      'RECRUITER',
      companyAId,
    );
    const leader = await createUser(
      `offer-leader-${suffix}@example.com`,
      'LEADER',
      companyAId,
    );
    await createUser(
      `offer-collab-${suffix}@example.com`,
      'COLLABORATOR',
      companyAId,
    );
    await createUser(
      `offer-admin-b-${suffix}@example.com`,
      'CLIENT_ADMIN',
      companyBId,
    );

    const seedEmp = await prisma.employee.create({
      data: {
        companyId: companyAId,
        firstName: 'Seed',
        lastName: 'Emp',
        email: `offer-seed-${suffix}@example.com`,
        areaId: areaAId,
        positionId: positionAId,
      },
    });
    employeeAId = seedEmp.id;

    const interviewer = await prisma.employee.create({
      data: {
        companyId: companyAId,
        firstName: 'Inter',
        lastName: 'Viewer',
        email: `offer-viewer-${suffix}@example.com`,
        areaId: areaAId,
        positionId: positionAId,
        userId: admin.id,
      },
    });
    interviewerEmployeeId = interviewer.id;

    const leaderEmp = await prisma.employee.create({
      data: {
        companyId: companyAId,
        firstName: 'Lead',
        lastName: 'Er',
        email: `offer-leader-emp-${suffix}@example.com`,
        areaId: areaAId,
        positionId: positionAId,
        userId: leader.id,
      },
    });
    leaderEmployeeId = leaderEmp.id;

    const vr = await prisma.vacancyRequest.create({
      data: {
        companyId: companyAId,
        requestedByEmployeeId: employeeAId,
        type: VacancyRequestType.EXISTING_POSITION,
        existingPositionId: positionAId,
        requestedHeadcount: 1,
        justification: 'Offer tests',
        status: VacancyRequestStatus.APPROVED,
        submittedAt: new Date(),
        approvedAt: new Date(),
      },
    });
    const vacancy = await prisma.vacancy.create({
      data: {
        companyId: companyAId,
        vacancyRequestId: vr.id,
        positionId: positionAId,
        areaId: areaAId,
        title: `Offer Vacancy ${suffix}`,
        headcount: 1,
        status: VacancyStatus.OPEN,
      },
    });
    vacancyId = vacancy.id;

    const main = await createApplication('main');
    applicationId = main.applicationId;
    candidateEmail = main.candidateEmail;

    adminToken = await login(`offer-admin-${suffix}@example.com`);
    recruiterToken = await login(`offer-recruiter-${suffix}@example.com`);
    leaderToken = await login(`offer-leader-${suffix}@example.com`);
    collaboratorToken = await login(`offer-collab-${suffix}@example.com`);
    adminBToken = await login(`offer-admin-b-${suffix}@example.com`);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('creates DRAFT offer when Application is INTERVIEW', async () => {
    await startInterview(applicationId);

    const appRow = await prisma.application.findUniqueOrThrow({
      where: { id: applicationId },
    });
    expect(appRow.stage).toBe(ApplicationStage.INTERVIEW);

    const created = await request(app.getHttpServer())
      .post(`/ats/applications/${applicationId}/offer`)
      .set(auth(recruiterToken))
      .send(offerBody())
      .expect(201);

    offerId = (created.body as { id: string }).id;
    expect((created.body as { status: string }).status).toBe(
      JobOfferStatus.DRAFT,
    );
    expect((created.body as { salaryCurrency: string }).salaryCurrency).toBe(
      'COP',
    );
    expect((created.body as { salaryPeriod: string }).salaryPeriod).toBe(
      SalaryPeriod.MONTHLY,
    );
  });

  it('returns 404 for cross-tenant GET offer', async () => {
    await request(app.getHttpServer())
      .get(`/ats/offers/${offerId}`)
      .set(auth(adminBToken, companyBId))
      .expect(404);

    await request(app.getHttpServer())
      .get(`/ats/applications/${applicationId}/offer`)
      .set(auth(adminBToken, companyBId))
      .expect(404);
  });

  it('updates DRAFT; rejects update after SENT', async () => {
    await request(app.getHttpServer())
      .patch(`/ats/offers/${offerId}`)
      .set(auth(recruiterToken))
      .send({ notes: 'Updated draft notes', salaryAmount: '4600000.00' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/ats/offers/${offerId}/send`)
      .set(auth(recruiterToken))
      .expect(400);

    await completeInterviewWithAnswers(applicationId);

    const sent = await request(app.getHttpServer())
      .post(`/ats/offers/${offerId}/send`)
      .set(auth(recruiterToken))
      .expect(201);

    expect((sent.body as { status: string }).status).toBe(JobOfferStatus.SENT);

    const appAfterSend = await prisma.application.findUniqueOrThrow({
      where: { id: applicationId },
    });
    expect(appAfterSend.stage).toBe(ApplicationStage.OFFER);

    await request(app.getHttpServer())
      .patch(`/ats/offers/${offerId}`)
      .set(auth(recruiterToken))
      .send({ notes: 'Should fail' })
      .expect(400);
  });

  it('rejects double send with 409', async () => {
    await request(app.getHttpServer())
      .post(`/ats/offers/${offerId}/send`)
      .set(auth(recruiterToken))
      .expect(409);
  });

  it('writes OFFER_SENT audit after send', async () => {
    const audit = await prisma.auditLog.findFirst({
      where: {
        companyId: companyAId,
        entityId: offerId,
        action: 'OFFER_SENT',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).toBeTruthy();
    expect(audit?.entity).toBe('JobOffer');
  });

  it('accept keeps Application OFFER and does not hire', async () => {
    const vacancyBefore = await prisma.vacancy.findUniqueOrThrow({
      where: { id: vacancyId },
    });
    vacancyFilledBeforeAccept = vacancyBefore.filledCount;

    const employeesBefore = await prisma.employee.count({
      where: { companyId: companyAId, email: candidateEmail },
    });

    const accepted = await request(app.getHttpServer())
      .post(`/ats/offers/${offerId}/accept`)
      .set(auth(recruiterToken))
      .expect(201);

    expect((accepted.body as { status: string }).status).toBe(
      JobOfferStatus.ACCEPTED,
    );

    const application = await prisma.application.findUniqueOrThrow({
      where: { id: applicationId },
    });
    expect(application.stage).toBe(ApplicationStage.OFFER);
    expect(application.status).toBe(ApplicationStatus.ACTIVE);

    const candidate = await prisma.candidate.findFirstOrThrow({
      where: { companyId: companyAId, email: candidateEmail },
    });
    expect(candidate.status).not.toBe(CandidateStatus.HIRED);

    const vacancyAfter = await prisma.vacancy.findUniqueOrThrow({
      where: { id: vacancyId },
    });
    expect(vacancyAfter.filledCount).toBe(vacancyFilledBeforeAccept);

    const employeesAfter = await prisma.employee.count({
      where: { companyId: companyAId, email: candidateEmail },
    });
    expect(employeesAfter).toBe(employeesBefore);
  });

  it('rejects accept on expired SENT offer', async () => {
    const seeded = await createSentOffer('expired');
    await prisma.jobOffer.update({
      where: { id: seeded.offerId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    await request(app.getHttpServer())
      .post(`/ats/offers/${seeded.offerId}/accept`)
      .set(auth(recruiterToken))
      .expect(400);
  });

  it('handles concurrent double accept (one success, one 409)', async () => {
    const seeded = await createSentOffer('concurrent');

    const results = await Promise.all([
      request(app.getHttpServer())
        .post(`/ats/offers/${seeded.offerId}/accept`)
        .set(auth(recruiterToken)),
      request(app.getHttpServer())
        .post(`/ats/offers/${seeded.offerId}/accept`)
        .set(auth(adminToken)),
    ]);

    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409]);

    const offer = await prisma.jobOffer.findUniqueOrThrow({
      where: { id: seeded.offerId },
    });
    expect(offer.status).toBe(JobOfferStatus.ACCEPTED);
  });

  it('rejects SENT offer and keeps Application in OFFER', async () => {
    const seeded = await createSentOffer('reject');

    const rejected = await request(app.getHttpServer())
      .post(`/ats/offers/${seeded.offerId}/reject`)
      .set(auth(recruiterToken))
      .expect(201);

    expect((rejected.body as { status: string }).status).toBe(
      JobOfferStatus.REJECTED,
    );

    const application = await prisma.application.findUniqueOrThrow({
      where: { id: seeded.applicationId },
    });
    expect(application.stage).toBe(ApplicationStage.OFFER);
    expect(application.status).toBe(ApplicationStatus.ACTIVE);
  });

  it('withdraws DRAFT offer', async () => {
    const seeded = await createApplication('withdraw');
    await startInterview(seeded.applicationId);

    const created = await request(app.getHttpServer())
      .post(`/ats/applications/${seeded.applicationId}/offer`)
      .set(auth(recruiterToken))
      .send(offerBody({ positionTitle: `Withdraw ${suffix}` }))
      .expect(201);
    const id = (created.body as { id: string }).id;

    const withdrawn = await request(app.getHttpServer())
      .post(`/ats/offers/${id}/withdraw`)
      .set(auth(recruiterToken))
      .expect(201);

    expect((withdrawn.body as { status: string }).status).toBe(
      JobOfferStatus.WITHDRAWN,
    );
  });

  it('enforces RBAC for collaborator, leader and recruiter', async () => {
    const seeded = await createApplication('rbac');
    await startInterview(seeded.applicationId);

    await request(app.getHttpServer())
      .post(`/ats/applications/${seeded.applicationId}/offer`)
      .set(auth(collaboratorToken))
      .send(offerBody({ positionTitle: `RBAC collab ${suffix}` }))
      .expect(403);

    await request(app.getHttpServer())
      .post(`/ats/applications/${seeded.applicationId}/offer`)
      .set(auth(leaderToken))
      .send(offerBody({ positionTitle: `RBAC leader ${suffix}` }))
      .expect(403);

    const created = await request(app.getHttpServer())
      .post(`/ats/applications/${seeded.applicationId}/offer`)
      .set(auth(recruiterToken))
      .send(offerBody({ positionTitle: `RBAC recruiter ${suffix}` }))
      .expect(201);
    const id = (created.body as { id: string }).id;

    await request(app.getHttpServer())
      .get(`/ats/offers/${id}`)
      .set(auth(leaderToken))
      .expect(200);

    await completeInterviewWithAnswers(seeded.applicationId);
    await request(app.getHttpServer())
      .post(`/ats/offers/${id}/send`)
      .set(auth(recruiterToken))
      .expect(201);

    await request(app.getHttpServer())
      .post(`/ats/offers/${id}/accept`)
      .set(auth(recruiterToken))
      .expect(201);
  });
});
