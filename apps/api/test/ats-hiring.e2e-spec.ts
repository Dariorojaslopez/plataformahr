import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  ApplicationStage,
  ApplicationStatus,
  CandidateStatus,
  CompanyStatus,
  EmployeeStatus,
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

describe('ATS hiring (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let hasher: PasswordHashingService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const password = `HirePass-${suffix}!`;

  let companyAId = '';
  let companyBId = '';
  let areaAId = '';
  let positionAId = '';
  let employeeAId = '';
  let interviewerEmployeeId = '';
  let leaderEmployeeId = '';
  let vacancyId = '';

  let adminToken = '';
  let recruiterToken = '';
  let leaderToken = '';
  let collaboratorToken = '';
  let adminBToken = '';

  const offerBody = (overrides: Record<string, unknown> = {}) => ({
    positionTitle: `Hire Role ${suffix}`,
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

  const createVacancy = async (headcount: number, tag = 'v') => {
    const vr = await prisma.vacancyRequest.create({
      data: {
        companyId: companyAId,
        requestedByEmployeeId: employeeAId,
        type: VacancyRequestType.EXISTING_POSITION,
        existingPositionId: positionAId,
        requestedHeadcount: headcount,
        justification: `Hiring tests ${tag}`,
        status: VacancyRequestStatus.APPROVED,
        submittedAt: new Date(),
        approvedAt: new Date(),
      },
    });
    return prisma.vacancy.create({
      data: {
        companyId: companyAId,
        vacancyRequestId: vr.id,
        positionId: positionAId,
        areaId: areaAId,
        title: `Hire Vacancy ${tag} ${suffix}`,
        headcount,
        status: VacancyStatus.OPEN,
      },
    });
  };

  const createApplication = async (
    tag: string,
    targetVacancyId = vacancyId,
  ) => {
    const candidate = await prisma.candidate.create({
      data: {
        companyId: companyAId,
        firstName: 'Cand',
        lastName: tag,
        email: `hire-cand-${tag}-${suffix}@example.com`,
      },
    });
    const application = await prisma.application.create({
      data: {
        companyId: companyAId,
        candidateId: candidate.id,
        vacancyId: targetVacancyId,
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

  const completeInterviewWithTextarea = async (appId: string) => {
    const template = await request(app.getHttpServer())
      .post('/ats/interview-form-templates')
      .set(auth(recruiterToken))
      .send({
        name: `Hire Form ${appId.slice(0, 8)} ${suffix}`,
        type: InterviewType.TECHNICAL,
        questions: [
          {
            text: 'Why hire?',
            type: InterviewQuestionType.TEXTAREA,
            required: true,
            order: 0,
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
        interviewerEmployeeIds: [interviewerEmployeeId, leaderEmployeeId],
        templateId: (template.body as { id: string }).id,
      })
      .expect(201);
    const interviewId = (interviewRes.body as { id: string }).id;
    const questions = (interviewRes.body as { questions: { id: string }[] })
      .questions;

    await request(app.getHttpServer())
      .post(`/ats/interviews/${interviewId}/start`)
      .set(auth(recruiterToken))
      .expect(201);

    await request(app.getHttpServer())
      .put(`/ats/interviews/${interviewId}/questions/${questions[0].id}/answer`)
      .set(auth(leaderToken))
      .send({ answerText: 'Strong fit for the role and culture' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/ats/interviews/${interviewId}/complete`)
      .set(auth(recruiterToken))
      .expect(201);

    return interviewId;
  };

  const createAcceptedOffer = async (
    tag: string,
    targetVacancyId = vacancyId,
  ) => {
    const seeded = await createApplication(tag, targetVacancyId);
    await completeInterviewWithTextarea(seeded.applicationId);

    const created = await request(app.getHttpServer())
      .post(`/ats/applications/${seeded.applicationId}/offer`)
      .set(auth(recruiterToken))
      .send(offerBody({ positionTitle: `Hire Offer ${tag} ${suffix}` }))
      .expect(201);
    const offerId = (created.body as { id: string }).id;

    await request(app.getHttpServer())
      .post(`/ats/offers/${offerId}/send`)
      .set(auth(recruiterToken))
      .expect(201);

    await request(app.getHttpServer())
      .post(`/ats/offers/${offerId}/accept`)
      .set(auth(recruiterToken))
      .expect(201);

    return { ...seeded, offerId };
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
        name: `Hire A ${suffix}`,
        slug: `hire-a-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    const companyB = await prisma.company.create({
      data: {
        name: `Hire B ${suffix}`,
        slug: `hire-b-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    companyAId = companyA.id;
    companyBId = companyB.id;

    const bu = await prisma.businessUnit.create({
      data: { companyId: companyAId, name: `Hire BU ${suffix}` },
    });
    const areaA = await prisma.area.create({
      data: {
        companyId: companyAId,
        businessUnitId: bu.id,
        name: `Hire Area ${suffix}`,
      },
    });
    areaAId = areaA.id;

    const jobLevel = await prisma.jobLevel.create({
      data: {
        companyId: companyAId,
        name: `Hire JL ${suffix}`,
        rank: 2000 + Math.floor(Math.random() * 1000),
      },
    });

    const positionA = await prisma.position.create({
      data: {
        companyId: companyAId,
        areaId: areaAId,
        jobLevelId: jobLevel.id,
        name: `Hire Position ${suffix}`,
        headcount: 20,
      },
    });
    positionAId = positionA.id;

    const hiringPermissions = [
      {
        code: 'ats.hiring.read',
        name: 'Read hirings',
        description: 'View formal hiring records',
      },
      {
        code: 'ats.hiring.manage',
        name: 'Manage hirings',
        description: 'Execute formal hiring from accepted offers',
      },
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
      {
        code: 'ats.interview.read',
        name: 'Read interviews',
        description: 'View interviews',
      },
      {
        code: 'ats.interview.manage',
        name: 'Manage interviews',
        description: 'Create and manage interviews',
      },
      {
        code: 'ats.interview.evaluate',
        name: 'Evaluate interviews',
        description: 'Answer interview questions',
      },
      {
        code: 'ats.application.read',
        name: 'Read applications',
        description: 'View applications',
      },
      {
        code: 'ats.application.manage',
        name: 'Manage applications',
        description: 'Move and manage applications',
      },
    ] as const;

    const permissionIds = new Map<string, string>();
    for (const permission of hiringPermissions) {
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

    const permissionByRole: Record<string, string[]> = {
      CLIENT_ADMIN: [
        'ats.hiring.read',
        'ats.hiring.manage',
        'ats.offer.read',
        'ats.offer.manage',
        'ats.offer.respond',
        'ats.interview.read',
        'ats.interview.manage',
        'ats.interview.evaluate',
        'ats.application.read',
        'ats.application.manage',
      ],
      RECRUITER: [
        'ats.hiring.read',
        'ats.hiring.manage',
        'ats.offer.read',
        'ats.offer.manage',
        'ats.offer.respond',
        'ats.interview.read',
        'ats.interview.manage',
        'ats.interview.evaluate',
        'ats.application.read',
        'ats.application.manage',
      ],
      LEADER: [
        'ats.hiring.read',
        'ats.offer.read',
        'ats.interview.read',
        'ats.interview.evaluate',
        'ats.application.read',
      ],
    };

    for (const [roleCode, codes] of Object.entries(permissionByRole)) {
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
      `hire-admin-${suffix}@example.com`,
      'CLIENT_ADMIN',
      companyAId,
    );
    await createUser(
      `hire-recruiter-${suffix}@example.com`,
      'RECRUITER',
      companyAId,
    );
    const leader = await createUser(
      `hire-leader-${suffix}@example.com`,
      'LEADER',
      companyAId,
    );
    await createUser(
      `hire-collab-${suffix}@example.com`,
      'COLLABORATOR',
      companyAId,
    );
    await createUser(
      `hire-admin-b-${suffix}@example.com`,
      'CLIENT_ADMIN',
      companyBId,
    );

    const seedEmp = await prisma.employee.create({
      data: {
        companyId: companyAId,
        firstName: 'Seed',
        lastName: 'Emp',
        email: `hire-seed-${suffix}@example.com`,
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
        email: `hire-viewer-${suffix}@example.com`,
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
        email: `hire-leader-emp-${suffix}@example.com`,
        areaId: areaAId,
        positionId: positionAId,
        userId: leader.id,
      },
    });
    leaderEmployeeId = leaderEmp.id;

    const vacancy = await createVacancy(10, 'main');
    vacancyId = vacancy.id;

    adminToken = await login(`hire-admin-${suffix}@example.com`);
    recruiterToken = await login(`hire-recruiter-${suffix}@example.com`);
    leaderToken = await login(`hire-leader-${suffix}@example.com`);
    collaboratorToken = await login(`hire-collab-${suffix}@example.com`);
    adminBToken = await login(`hire-admin-b-${suffix}@example.com`);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('hires successfully from ACCEPTED offer', async () => {
    const seeded = await createAcceptedOffer('ok');
    const vacancyBefore = await prisma.vacancy.findUniqueOrThrow({
      where: { id: vacancyId },
    });
    const hireDate = '2026-08-01';

    const hired = await request(app.getHttpServer())
      .post(`/ats/applications/${seeded.applicationId}/hire`)
      .set(auth(adminToken))
      .send({ hireDate })
      .expect(201);

    expect((hired.body as { applicationId: string }).applicationId).toBe(
      seeded.applicationId,
    );
    expect((hired.body as { employee: { email: string } }).employee.email).toBe(
      seeded.candidateEmail.toLowerCase(),
    );
    expect(
      (hired.body as { employee: { status: string } }).employee.status,
    ).toBe(EmployeeStatus.ACTIVE);

    const application = await prisma.application.findUniqueOrThrow({
      where: { id: seeded.applicationId },
    });
    expect(application.stage).toBe(ApplicationStage.HIRED);
    expect(application.status).toBe(ApplicationStatus.CLOSED);

    const candidate = await prisma.candidate.findUniqueOrThrow({
      where: { id: seeded.candidateId },
    });
    expect(candidate.status).toBe(CandidateStatus.HIRED);

    const vacancyAfter = await prisma.vacancy.findUniqueOrThrow({
      where: { id: vacancyId },
    });
    expect(vacancyAfter.filledCount).toBe(vacancyBefore.filledCount + 1);
    expect(vacancyAfter.status).toBe(VacancyStatus.OPEN);

    const employee = await prisma.employee.findFirstOrThrow({
      where: {
        companyId: companyAId,
        email: seeded.candidateEmail.toLowerCase(),
        deletedAt: null,
      },
    });
    expect(employee.positionId).toBe(positionAId);
    expect(employee.areaId).toBe(areaAId);
    expect(employee.status).toBe(EmployeeStatus.ACTIVE);

    const hiring = await prisma.hiring.findUniqueOrThrow({
      where: { applicationId: seeded.applicationId },
    });
    expect(hiring.employeeId).toBe(employee.id);
    expect(hiring.jobOfferId).toBe(seeded.offerId);

    await request(app.getHttpServer())
      .get(`/ats/applications/${seeded.applicationId}/hiring`)
      .set(auth(adminToken))
      .expect(200);

    const audit = await prisma.auditLog.findFirst({
      where: {
        companyId: companyAId,
        entityId: hiring.id,
        action: 'HIRING_COMPLETED',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).toBeTruthy();
    expect(audit?.entity).toBe('Hiring');
  });

  it('rejects hire when offer is only SENT', async () => {
    const seeded = await createApplication('sent');
    await completeInterviewWithTextarea(seeded.applicationId);

    const created = await request(app.getHttpServer())
      .post(`/ats/applications/${seeded.applicationId}/offer`)
      .set(auth(recruiterToken))
      .send(offerBody({ positionTitle: `Sent only ${suffix}` }))
      .expect(201);
    const offerId = (created.body as { id: string }).id;

    await request(app.getHttpServer())
      .post(`/ats/offers/${offerId}/send`)
      .set(auth(recruiterToken))
      .expect(201);

    const offer = await prisma.jobOffer.findUniqueOrThrow({
      where: { id: offerId },
    });
    expect(offer.status).toBe(JobOfferStatus.SENT);

    await request(app.getHttpServer())
      .post(`/ats/applications/${seeded.applicationId}/hire`)
      .set(auth(adminToken))
      .send({ hireDate: '2026-08-02' })
      .expect(400);
  });

  it('rejects duplicate hire with 409 and no second Employee', async () => {
    const seeded = await createAcceptedOffer('dup');
    await request(app.getHttpServer())
      .post(`/ats/applications/${seeded.applicationId}/hire`)
      .set(auth(adminToken))
      .send({ hireDate: '2026-08-03' })
      .expect(201);

    const employeesBefore = await prisma.employee.count({
      where: {
        companyId: companyAId,
        email: seeded.candidateEmail.toLowerCase(),
        deletedAt: null,
      },
    });

    await request(app.getHttpServer())
      .post(`/ats/applications/${seeded.applicationId}/hire`)
      .set(auth(adminToken))
      .send({ hireDate: '2026-08-04' })
      .expect(409);

    const employeesAfter = await prisma.employee.count({
      where: {
        companyId: companyAId,
        email: seeded.candidateEmail.toLowerCase(),
        deletedAt: null,
      },
    });
    expect(employeesAfter).toBe(employeesBefore);
    expect(employeesAfter).toBe(1);
  });

  it('rejects hire when Employee with same email already exists', async () => {
    const seeded = await createAcceptedOffer('preemp');
    const vacancyBefore = await prisma.vacancy.findUniqueOrThrow({
      where: { id: vacancyId },
    });

    await prisma.employee.create({
      data: {
        companyId: companyAId,
        firstName: 'Existing',
        lastName: 'Emp',
        email: seeded.candidateEmail.toLowerCase(),
        areaId: areaAId,
        positionId: positionAId,
        status: EmployeeStatus.ACTIVE,
      },
    });

    await request(app.getHttpServer())
      .post(`/ats/applications/${seeded.applicationId}/hire`)
      .set(auth(adminToken))
      .send({ hireDate: '2026-08-05' })
      .expect(409);

    const application = await prisma.application.findUniqueOrThrow({
      where: { id: seeded.applicationId },
    });
    expect(application.stage).toBe(ApplicationStage.OFFER);
    expect(application.status).toBe(ApplicationStatus.ACTIVE);

    const vacancyAfter = await prisma.vacancy.findUniqueOrThrow({
      where: { id: vacancyId },
    });
    expect(vacancyAfter.filledCount).toBe(vacancyBefore.filledCount);

    const hiringCount = await prisma.hiring.count({
      where: { applicationId: seeded.applicationId },
    });
    expect(hiringCount).toBe(0);
  });

  it('rejects generic move to HIRED', async () => {
    const seeded = await createApplication('movehire');

    const res = await request(app.getHttpServer())
      .post(`/ats/applications/${seeded.applicationId}/move`)
      .set(auth(recruiterToken))
      .send({ stage: ApplicationStage.HIRED })
      .expect(400);

    expect(JSON.stringify(res.body)).toMatch(/HIRED|Hiring/i);

    const application = await prisma.application.findUniqueOrThrow({
      where: { id: seeded.applicationId },
    });
    expect(application.stage).toBe(ApplicationStage.CONTACTED);
  });

  it('returns 404 for cross-tenant hire', async () => {
    const seeded = await createAcceptedOffer('xtenant');

    await request(app.getHttpServer())
      .post(`/ats/applications/${seeded.applicationId}/hire`)
      .set(auth(adminBToken, companyBId))
      .send({ hireDate: '2026-08-06' })
      .expect(404);
  });

  it('enforces RBAC: collaborator cannot hire; leader can read hiring', async () => {
    const seeded = await createAcceptedOffer('rbac');

    await request(app.getHttpServer())
      .post(`/ats/applications/${seeded.applicationId}/hire`)
      .set(auth(collaboratorToken))
      .send({ hireDate: '2026-08-07' })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/ats/applications/${seeded.applicationId}/hire`)
      .set(auth(adminToken))
      .send({ hireDate: '2026-08-07' })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/ats/applications/${seeded.applicationId}/hiring`)
      .set(auth(leaderToken))
      .expect(200);
  });

  it('handles concurrent hire on same application (one success, one 409)', async () => {
    const seeded = await createAcceptedOffer('concapp');
    const vacancyBefore = await prisma.vacancy.findUniqueOrThrow({
      where: { id: vacancyId },
    });

    const results = await Promise.all([
      request(app.getHttpServer())
        .post(`/ats/applications/${seeded.applicationId}/hire`)
        .set(auth(adminToken))
        .send({ hireDate: '2026-08-08' }),
      request(app.getHttpServer())
        .post(`/ats/applications/${seeded.applicationId}/hire`)
        .set(auth(recruiterToken))
        .send({ hireDate: '2026-08-08' }),
    ]);

    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409]);

    const hiringCount = await prisma.hiring.count({
      where: { applicationId: seeded.applicationId },
    });
    expect(hiringCount).toBe(1);

    const employeeCount = await prisma.employee.count({
      where: {
        companyId: companyAId,
        email: seeded.candidateEmail.toLowerCase(),
        deletedAt: null,
      },
    });
    expect(employeeCount).toBe(1);

    const vacancyAfter = await prisma.vacancy.findUniqueOrThrow({
      where: { id: vacancyId },
    });
    expect(vacancyAfter.filledCount).toBe(vacancyBefore.filledCount + 1);
  });

  it('handles concurrent hire for last vacancy slot (headcount=1)', async () => {
    const vacancy = await createVacancy(1, 'last-slot');
    const a = await createAcceptedOffer('slot-a', vacancy.id);
    const b = await createAcceptedOffer('slot-b', vacancy.id);

    const results = await Promise.all([
      request(app.getHttpServer())
        .post(`/ats/applications/${a.applicationId}/hire`)
        .set(auth(adminToken))
        .send({ hireDate: '2026-08-09' }),
      request(app.getHttpServer())
        .post(`/ats/applications/${b.applicationId}/hire`)
        .set(auth(recruiterToken))
        .send({ hireDate: '2026-08-09' }),
    ]);

    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409]);

    const hiredApps = await prisma.application.count({
      where: {
        vacancyId: vacancy.id,
        stage: ApplicationStage.HIRED,
        deletedAt: null,
      },
    });
    expect(hiredApps).toBe(1);

    const hiringCount = await prisma.hiring.count({
      where: { vacancyId: vacancy.id },
    });
    expect(hiringCount).toBe(1);

    const vacancyAfter = await prisma.vacancy.findUniqueOrThrow({
      where: { id: vacancy.id },
    });
    expect(vacancyAfter.filledCount).toBe(1);
    expect(vacancyAfter.status).toBe(VacancyStatus.OPEN);
  });

  it('rejects hire when vacancy capacity is already full', async () => {
    const vacancy = await createVacancy(1, 'full');
    await prisma.vacancy.update({
      where: { id: vacancy.id },
      data: { filledCount: 1 },
    });

    const seeded = await createAcceptedOffer('fullcap', vacancy.id);
    const vacancyBefore = await prisma.vacancy.findUniqueOrThrow({
      where: { id: vacancy.id },
    });
    expect(vacancyBefore.filledCount).toBe(1);

    await request(app.getHttpServer())
      .post(`/ats/applications/${seeded.applicationId}/hire`)
      .set(auth(adminToken))
      .send({ hireDate: '2026-08-10' })
      .expect(409);

    const application = await prisma.application.findUniqueOrThrow({
      where: { id: seeded.applicationId },
    });
    expect(application.stage).toBe(ApplicationStage.OFFER);

    const vacancyAfter = await prisma.vacancy.findUniqueOrThrow({
      where: { id: vacancy.id },
    });
    expect(vacancyAfter.filledCount).toBe(1);

    const hiringCount = await prisma.hiring.count({
      where: { applicationId: seeded.applicationId },
    });
    expect(hiringCount).toBe(0);
  });
});
