import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  ApplicationStage,
  ApplicationStatus,
  CompanyStatus,
  InterviewQuestionType,
  InterviewStatus,
  InterviewType,
  MembershipStatus,
  PrismaClient,
  RoleScope,
  TranscriptSegmentKind,
  UserStatus,
  VacancyRequestStatus,
  VacancyRequestType,
  VacancyStatus,
} from '@prisma/client';
import { join } from 'node:path';
import { loadOptionalEnvFile } from './load-env';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { InterviewsService } from '../src/ats/interviews/interviews.service';
import { PasswordHashingService } from '../src/auth/password-hashing.service';

loadOptionalEnvFile(join(__dirname, '../.env'));

describe('ATS interviews (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let hasher: PasswordHashingService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const password = `IntPass-${suffix}!`;

  let companyAId = '';
  let companyBId = '';
  let areaAId = '';
  let positionAId = '';
  let employeeAId = '';
  let interviewerEmployeeId = '';
  let leaderEmployeeId = '';
  let foreignEmployeeId = '';
  let vacancyId = '';
  let applicationId = '';
  let candidateId = '';

  let adminToken = '';
  let recruiterToken = '';
  let leaderToken = '';
  let collaboratorToken = '';
  let adminBToken = '';
  let leaderUserId = '';

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
        name: `Int A ${suffix}`,
        slug: `int-a-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    const companyB = await prisma.company.create({
      data: {
        name: `Int B ${suffix}`,
        slug: `int-b-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    companyAId = companyA.id;
    companyBId = companyB.id;

    const areaA = await prisma.area.create({
      data: { companyId: companyAId, name: `Int Area ${suffix}` },
    });
    areaAId = areaA.id;
    const areaB = await prisma.area.create({
      data: { companyId: companyBId, name: `Int Area B ${suffix}` },
    });

    const positionA = await prisma.position.create({
      data: {
        companyId: companyAId,
        areaId: areaAId,
        name: `Role ${suffix}`,
        headcount: 5,
      },
    });
    positionAId = positionA.id;
    const positionB = await prisma.position.create({
      data: {
        companyId: companyBId,
        areaId: areaB.id,
        name: `Role B ${suffix}`,
        headcount: 2,
      },
    });

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
      `int-admin-${suffix}@example.com`,
      'CLIENT_ADMIN',
      companyAId,
    );
    await createUser(
      `int-recruiter-${suffix}@example.com`,
      'RECRUITER',
      companyAId,
    );
    const leader = await createUser(
      `int-leader-${suffix}@example.com`,
      'LEADER',
      companyAId,
    );
    leaderUserId = leader.id;
    await createUser(
      `int-collab-${suffix}@example.com`,
      'COLLABORATOR',
      companyAId,
    );
    await createUser(
      `int-admin-b-${suffix}@example.com`,
      'CLIENT_ADMIN',
      companyBId,
    );

    const seedEmp = await prisma.employee.create({
      data: {
        companyId: companyAId,
        firstName: 'Seed',
        lastName: 'Emp',
        email: `int-seed-${suffix}@example.com`,
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
        email: `int-viewer-${suffix}@example.com`,
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
        email: `int-leader-emp-${suffix}@example.com`,
        areaId: areaAId,
        positionId: positionAId,
        userId: leader.id,
      },
    });
    leaderEmployeeId = leaderEmp.id;

    const foreignEmp = await prisma.employee.create({
      data: {
        companyId: companyBId,
        firstName: 'Foreign',
        lastName: 'Emp',
        email: `int-foreign-${suffix}@example.com`,
        areaId: areaB.id,
        positionId: positionB.id,
      },
    });
    foreignEmployeeId = foreignEmp.id;

    const vr = await prisma.vacancyRequest.create({
      data: {
        companyId: companyAId,
        requestedByEmployeeId: employeeAId,
        type: VacancyRequestType.EXISTING_POSITION,
        existingPositionId: positionAId,
        requestedHeadcount: 1,
        justification: 'Interview tests',
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
        title: `Vacancy ${suffix}`,
        headcount: 1,
        status: VacancyStatus.OPEN,
      },
    });
    vacancyId = vacancy.id;

    const candidate = await prisma.candidate.create({
      data: {
        companyId: companyAId,
        firstName: 'Cand',
        lastName: 'Idate',
        email: `int-cand-${suffix}@example.com`,
      },
    });
    candidateId = candidate.id;

    const application = await prisma.application.create({
      data: {
        companyId: companyAId,
        candidateId,
        vacancyId,
        stage: ApplicationStage.CONTACTED,
        status: ApplicationStatus.ACTIVE,
      },
    });
    applicationId = application.id;

    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(201);
      return (res.body as { accessToken: string }).accessToken;
    };

    adminToken = await login(`int-admin-${suffix}@example.com`);
    recruiterToken = await login(`int-recruiter-${suffix}@example.com`);
    leaderToken = await login(`int-leader-${suffix}@example.com`);
    collaboratorToken = await login(`int-collab-${suffix}@example.com`);
    adminBToken = await login(`int-admin-b-${suffix}@example.com`);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const auth = (token: string, companyId = companyAId) => ({
    Authorization: `Bearer ${token}`,
    'X-Company-Id': companyId,
  });

  it('creates interview with interviewers and template snapshot', async () => {
    const template = await request(app.getHttpServer())
      .post('/ats/interview-form-templates')
      .set(auth(recruiterToken))
      .send({
        name: `HR Form ${suffix}`,
        type: InterviewType.HR,
        questions: [
          {
            text: 'Experience?',
            type: InterviewQuestionType.TEXTAREA,
            required: true,
            order: 0,
          },
          {
            text: 'Score',
            type: InterviewQuestionType.RATING,
            required: true,
            order: 1,
          },
        ],
      })
      .expect(201);

    const templateId = (template.body as { id: string }).id;
    const originalQuestionText = (
      template.body as { questions: { text: string }[] }
    ).questions[0].text;

    const created = await request(app.getHttpServer())
      .post(`/ats/applications/${applicationId}/interviews`)
      .set(auth(recruiterToken))
      .send({
        type: InterviewType.HR,
        scheduledAt: new Date().toISOString(),
        interviewerEmployeeIds: [interviewerEmployeeId, leaderEmployeeId],
        templateId,
        localRecordingName: 'session-room-a.webm',
      })
      .expect(201);

    expect((created.body as { status: string }).status).toBe(
      InterviewStatus.SCHEDULED,
    );
    expect(
      (created.body as { interviewers: unknown[] }).interviewers,
    ).toHaveLength(2);
    expect((created.body as { questions: unknown[] }).questions).toHaveLength(
      2,
    );
    expect(
      (created.body as { localRecordingName: string }).localRecordingName,
    ).toBe('session-room-a.webm');
    expect(JSON.stringify(created.body)).not.toMatch(/audio|s3|minio|base64/i);

    await request(app.getHttpServer())
      .patch(`/ats/interview-form-templates/${templateId}`)
      .set(auth(recruiterToken))
      .send({ name: 'Renamed' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/ats/interview-form-templates/${templateId}/questions`)
      .set(auth(recruiterToken))
      .send({
        text: 'New question after snapshot',
        type: InterviewQuestionType.YES_NO,
        order: 2,
      })
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/ats/interviews/${(created.body as { id: string }).id}`)
      .set(auth(recruiterToken))
      .expect(200);

    expect((detail.body as { questions: unknown[] }).questions).toHaveLength(2);
    expect(
      (detail.body as { questions: { text: string }[] }).questions[0].text,
    ).toBe(originalQuestionText);
  });

  it('rejects cross-tenant interviewer and template', async () => {
    const foreignTemplate = await prisma.interviewFormTemplate.create({
      data: {
        companyId: companyBId,
        name: `Foreign ${suffix}`,
        type: InterviewType.GENERAL,
      },
    });

    await request(app.getHttpServer())
      .post(`/ats/applications/${applicationId}/interviews`)
      .set(auth(recruiterToken))
      .send({
        type: InterviewType.GENERAL,
        interviewerEmployeeIds: [foreignEmployeeId],
      })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/ats/applications/${applicationId}/interviews`)
      .set(auth(recruiterToken))
      .send({
        type: InterviewType.GENERAL,
        interviewerEmployeeIds: [interviewerEmployeeId],
        templateId: foreignTemplate.id,
      })
      .expect(404);
  });

  it('rejects interview on terminal application', async () => {
    const terminalApp = await prisma.application.create({
      data: {
        companyId: companyAId,
        candidateId: (
          await prisma.candidate.create({
            data: {
              companyId: companyAId,
              firstName: 'Term',
              lastName: 'Inal',
              email: `term-${suffix}@example.com`,
            },
          })
        ).id,
        vacancyId,
        stage: ApplicationStage.REJECTED,
        status: ApplicationStatus.CLOSED,
      },
    });

    await request(app.getHttpServer())
      .post(`/ats/applications/${terminalApp.id}/interviews`)
      .set(auth(recruiterToken))
      .send({
        type: InterviewType.HR,
        interviewerEmployeeIds: [interviewerEmployeeId],
      })
      .expect(400);
  });

  it('rejects filesystem-like localRecordingName', async () => {
    await request(app.getHttpServer())
      .post(`/ats/applications/${applicationId}/interviews`)
      .set(auth(recruiterToken))
      .send({
        type: InterviewType.HR,
        interviewerEmployeeIds: [interviewerEmployeeId],
        localRecordingName: '/Users/me/recording.webm',
      })
      .expect(400);
  });

  it('runs lifecycle, stage integration, answers, transcript and concurrency', async () => {
    const template = await request(app.getHttpServer())
      .post('/ats/interview-form-templates')
      .set(auth(adminToken))
      .send({
        name: `Tech ${suffix}`,
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
      .post(`/ats/applications/${applicationId}/interviews`)
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
      .post(`/ats/interviews/${interviewId}/complete`)
      .set(auth(recruiterToken))
      .expect(400);

    const historyBefore = await prisma.applicationStageHistory.count({
      where: { applicationId, toStage: ApplicationStage.INTERVIEW },
    });

    await request(app.getHttpServer())
      .post(`/ats/interviews/${interviewId}/start`)
      .set(auth(recruiterToken))
      .expect(201);

    const appAfter = await prisma.application.findUniqueOrThrow({
      where: { id: applicationId },
    });
    expect(appAfter.stage).toBe(ApplicationStage.INTERVIEW);

    const historyAfter = await prisma.applicationStageHistory.count({
      where: { applicationId, toStage: ApplicationStage.INTERVIEW },
    });
    expect(historyAfter).toBe(historyBefore + 1);

    const second = await request(app.getHttpServer())
      .post(`/ats/applications/${applicationId}/interviews`)
      .set(auth(recruiterToken))
      .send({
        type: InterviewType.MANAGER,
        scheduledAt: new Date().toISOString(),
        interviewerEmployeeIds: [leaderEmployeeId],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/ats/interviews/${(second.body as { id: string }).id}/start`)
      .set(auth(recruiterToken))
      .expect(201);
    const historyFinal = await prisma.applicationStageHistory.count({
      where: { applicationId, toStage: ApplicationStage.INTERVIEW },
    });
    expect(historyFinal).toBe(historyAfter);

    await request(app.getHttpServer())
      .post(`/ats/interviews/${interviewId}/complete`)
      .set(auth(recruiterToken))
      .expect(400);

    await request(app.getHttpServer())
      .put(`/ats/interviews/${interviewId}/questions/${questions[0].id}/answer`)
      .set(auth(collaboratorToken))
      .send({ answerText: 'Nope' })
      .expect(403);

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

    expect(
      (
        await prisma.application.findUniqueOrThrow({
          where: { id: applicationId },
        })
      ).stage,
    ).toBe(ApplicationStage.INTERVIEW);

    await request(app.getHttpServer())
      .put(`/ats/interviews/${interviewId}/questions/${questions[0].id}/answer`)
      .set(auth(leaderToken))
      .send({ answerText: 'Edit after complete' })
      .expect(400);

    const cancelled = await request(app.getHttpServer())
      .post(`/ats/applications/${applicationId}/interviews`)
      .set(auth(recruiterToken))
      .send({
        type: InterviewType.OTHER,
        interviewerEmployeeIds: [leaderEmployeeId],
      })
      .expect(201);
    const cancelledId = (cancelled.body as { id: string }).id;
    await request(app.getHttpServer())
      .post(`/ats/interviews/${cancelledId}/cancel`)
      .set(auth(recruiterToken))
      .expect(201);

    const cancelledQuestions = await prisma.interviewQuestion.findMany({
      where: { interviewId: cancelledId },
    });
    if (cancelledQuestions[0]) {
      await request(app.getHttpServer())
        .put(
          `/ats/interviews/${cancelledId}/questions/${cancelledQuestions[0].id}/answer`,
        )
        .set(auth(leaderToken))
        .send({ answerText: 'x' })
        .expect(400);
    }

    const live = await request(app.getHttpServer())
      .post(`/ats/applications/${applicationId}/interviews`)
      .set(auth(recruiterToken))
      .send({
        type: InterviewType.GENERAL,
        scheduledAt: new Date().toISOString(),
        interviewerEmployeeIds: [leaderEmployeeId],
      })
      .expect(201);
    const liveId = (live.body as { id: string }).id;
    await request(app.getHttpServer())
      .post(`/ats/interviews/${liveId}/start`)
      .set(auth(recruiterToken))
      .expect(201);

    const seg = await request(app.getHttpServer())
      .post(`/ats/interviews/${liveId}/transcript/segments`)
      .set(auth(leaderToken))
      .send({
        text: 'Tell me about yourself',
        kind: TranscriptSegmentKind.QUESTION,
        speakerLabel: 'Entrevistador',
      })
      .expect(201);
    expect((seg.body as { sequence: number }).sequence).toBe(0);

    const segId = (seg.body as { id: string }).id;
    await request(app.getHttpServer())
      .patch(`/ats/interviews/${liveId}/transcript/segments/${segId}`)
      .set(auth(leaderToken))
      .send({ kind: TranscriptSegmentKind.ANSWER, text: 'I am a developer' })
      .expect(200);

    const service = app.get(InterviewsService);
    const results = await Promise.allSettled([
      service.addTranscriptSegment(
        companyAId,
        leaderUserId,
        (
          await prisma.companyMembership.findFirstOrThrow({
            where: { userId: leaderUserId, companyId: companyAId },
          })
        ).id,
        liveId,
        { text: 'Concurrent A' },
      ),
      service.addTranscriptSegment(
        companyAId,
        leaderUserId,
        (
          await prisma.companyMembership.findFirstOrThrow({
            where: { userId: leaderUserId, companyId: companyAId },
          })
        ).id,
        liveId,
        { text: 'Concurrent B' },
      ),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
    const sequences = (
      await prisma.interviewTranscriptSegment.findMany({
        where: { interviewId: liveId },
        orderBy: { sequence: 'asc' },
      })
    ).map((s) => s.sequence);
    expect(new Set(sequences).size).toBe(sequences.length);

    await request(app.getHttpServer())
      .delete(`/ats/interviews/${liveId}/transcript/segments/${segId}`)
      .set(auth(leaderToken))
      .expect(200);

    const audit = await prisma.auditLog.findFirst({
      where: {
        companyId: companyAId,
        action: 'TRANSCRIPT_SEGMENT_CREATED',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(JSON.stringify(audit?.metadata ?? {})).not.toContain(
      'Tell me about yourself',
    );
  });

  it('enforces tenant isolation and RBAC', async () => {
    const list = await request(app.getHttpServer())
      .get(`/ats/applications/${applicationId}/interviews`)
      .set(auth(leaderToken))
      .expect(200);
    expect(Array.isArray(list.body)).toBe(true);

    await request(app.getHttpServer())
      .post(`/ats/applications/${applicationId}/interviews`)
      .set(auth(leaderToken))
      .send({
        type: InterviewType.HR,
        interviewerEmployeeIds: [leaderEmployeeId],
      })
      .expect(403);

    await request(app.getHttpServer())
      .get(`/ats/applications/${applicationId}/interviews`)
      .set(auth(collaboratorToken))
      .expect(403);

    await request(app.getHttpServer())
      .get(`/ats/applications/${applicationId}/interviews`)
      .set(auth(adminBToken, companyBId))
      .expect(404);

    await request(app.getHttpServer())
      .get('/ats/interview-form-templates')
      .expect(401);
  });

  it('rejects invalid status transitions', async () => {
    const draft = await request(app.getHttpServer())
      .post(`/ats/applications/${applicationId}/interviews`)
      .set(auth(recruiterToken))
      .send({
        type: InterviewType.OTHER,
        interviewerEmployeeIds: [interviewerEmployeeId],
      })
      .expect(201);
    const id = (draft.body as { id: string }).id;
    expect((draft.body as { status: string }).status).toBe(
      InterviewStatus.DRAFT,
    );

    await request(app.getHttpServer())
      .post(`/ats/interviews/${id}/start`)
      .set(auth(recruiterToken))
      .expect(400);

    await request(app.getHttpServer())
      .post(`/ats/interviews/${id}/complete`)
      .set(auth(recruiterToken))
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/ats/interviews/${id}`)
      .set(auth(recruiterToken))
      .send({ scheduledAt: new Date().toISOString() })
      .expect(200);

    const scheduled = await prisma.interview.findUniqueOrThrow({
      where: { id },
    });
    expect(scheduled.status).toBe(InterviewStatus.SCHEDULED);
  });
});
