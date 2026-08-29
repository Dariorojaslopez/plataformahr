import {
  ConflictException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  ApplicationStage,
  CandidateStatus,
  CompanyStatus,
  MembershipStatus,
  PrismaClient,
  RoleScope,
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
import { ApplicationsService } from '../src/ats/applications/applications.service';
import { PasswordHashingService } from '../src/auth/password-hashing.service';

loadOptionalEnvFile(join(__dirname, '../.env'));

describe('ATS candidates & applications (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let hasher: PasswordHashingService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const password = `CandPass-${suffix}!`;

  let companyAId = '';
  let companyBId = '';
  let areaAId = '';
  let areaBId = '';
  let positionAId = '';
  let positionBId = '';
  let employeeAId = '';

  let vacancyOpenId = '';
  let vacancyOpen2Id = '';
  let vacancyClosedId = '';
  let vacancyCancelledId = '';
  let vacancyPausedId = '';
  let vacancyBId = '';

  let recruiterToken = '';
  let leaderToken = '';
  let collaboratorToken = '';
  let adminBToken = '';

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
        name: `Cand A ${suffix}`,
        slug: `cand-a-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    const companyB = await prisma.company.create({
      data: {
        name: `Cand B ${suffix}`,
        slug: `cand-b-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    companyAId = companyA.id;
    companyBId = companyB.id;

    const areaA = await prisma.area.create({
      data: { companyId: companyAId, name: `Cand Area A ${suffix}` },
    });
    const areaB = await prisma.area.create({
      data: { companyId: companyBId, name: `Cand Area B ${suffix}` },
    });
    areaAId = areaA.id;
    areaBId = areaB.id;

    const positionA = await prisma.position.create({
      data: {
        companyId: companyAId,
        areaId: areaAId,
        name: `Engineer ${suffix}`,
        headcount: 10,
      },
    });
    const positionB = await prisma.position.create({
      data: {
        companyId: companyBId,
        areaId: areaBId,
        name: `Engineer B ${suffix}`,
        headcount: 2,
      },
    });
    positionAId = positionA.id;
    positionBId = positionB.id;

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

    await createUser(
      `cand-admin-${suffix}@example.com`,
      'CLIENT_ADMIN',
      companyAId,
    );
    await createUser(
      `cand-recruiter-${suffix}@example.com`,
      'RECRUITER',
      companyAId,
    );
    await createUser(`cand-leader-${suffix}@example.com`, 'LEADER', companyAId);
    await createUser(
      `cand-collab-${suffix}@example.com`,
      'COLLABORATOR',
      companyAId,
    );
    await createUser(
      `cand-admin-b-${suffix}@example.com`,
      'CLIENT_ADMIN',
      companyBId,
    );

    const employee = await prisma.employee.create({
      data: {
        companyId: companyAId,
        firstName: 'Requester',
        lastName: 'Emp',
        email: `cand-emp-${suffix}@example.com`,
        areaId: areaAId,
        positionId: positionAId,
      },
    });
    employeeAId = employee.id;

    await prisma.employee.create({
      data: {
        companyId: companyBId,
        firstName: 'Requester',
        lastName: 'B',
        email: `cand-emp-b-${suffix}@example.com`,
        areaId: areaBId,
        positionId: positionBId,
      },
    });

    const createVacancy = async (opts: {
      companyId: string;
      areaId: string;
      positionId: string;
      employeeId: string;
      title: string;
      status: VacancyStatus;
    }) => {
      const vr = await prisma.vacancyRequest.create({
        data: {
          companyId: opts.companyId,
          requestedByEmployeeId: opts.employeeId,
          type: VacancyRequestType.EXISTING_POSITION,
          existingPositionId: opts.positionId,
          requestedHeadcount: 1,
          justification: `Seed vacancy ${opts.title}`,
          status: VacancyRequestStatus.APPROVED,
          submittedAt: new Date(),
          approvedAt: new Date(),
        },
      });
      return prisma.vacancy.create({
        data: {
          companyId: opts.companyId,
          vacancyRequestId: vr.id,
          positionId: opts.positionId,
          areaId: opts.areaId,
          title: opts.title,
          headcount: 1,
          filledCount: 0,
          status: opts.status,
        },
      });
    };

    vacancyOpenId = (
      await createVacancy({
        companyId: companyAId,
        areaId: areaAId,
        positionId: positionAId,
        employeeId: employeeAId,
        title: `Open A1 ${suffix}`,
        status: VacancyStatus.OPEN,
      })
    ).id;
    vacancyOpen2Id = (
      await createVacancy({
        companyId: companyAId,
        areaId: areaAId,
        positionId: positionAId,
        employeeId: employeeAId,
        title: `Open A2 ${suffix}`,
        status: VacancyStatus.OPEN,
      })
    ).id;
    vacancyClosedId = (
      await createVacancy({
        companyId: companyAId,
        areaId: areaAId,
        positionId: positionAId,
        employeeId: employeeAId,
        title: `Closed ${suffix}`,
        status: VacancyStatus.CLOSED,
      })
    ).id;
    vacancyCancelledId = (
      await createVacancy({
        companyId: companyAId,
        areaId: areaAId,
        positionId: positionAId,
        employeeId: employeeAId,
        title: `Cancelled ${suffix}`,
        status: VacancyStatus.CANCELLED,
      })
    ).id;
    vacancyPausedId = (
      await createVacancy({
        companyId: companyAId,
        areaId: areaAId,
        positionId: positionAId,
        employeeId: employeeAId,
        title: `Paused ${suffix}`,
        status: VacancyStatus.PAUSED,
      })
    ).id;

    const empB = await prisma.employee.findFirstOrThrow({
      where: { companyId: companyBId },
    });
    vacancyBId = (
      await createVacancy({
        companyId: companyBId,
        areaId: areaBId,
        positionId: positionBId,
        employeeId: empB.id,
        title: `Open B ${suffix}`,
        status: VacancyStatus.OPEN,
      })
    ).id;

    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(201);
      return (res.body as { accessToken: string }).accessToken;
    };

    recruiterToken = await login(`cand-recruiter-${suffix}@example.com`);
    leaderToken = await login(`cand-leader-${suffix}@example.com`);
    collaboratorToken = await login(`cand-collab-${suffix}@example.com`);
    adminBToken = await login(`cand-admin-b-${suffix}@example.com`);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const auth = (token: string, companyId = companyAId) => ({
    Authorization: `Bearer ${token}`,
    'X-Company-Id': companyId,
  });

  describe('Candidate', () => {
    it('creates candidate and lowercases email', async () => {
      const res = await request(app.getHttpServer())
        .post('/ats/candidates')
        .set(auth(recruiterToken))
        .send({
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: `  Ada.Lovelace-${suffix}@Example.COM `,
        })
        .expect(201);

      expect((res.body as { email: string }).email).toBe(
        `ada.lovelace-${suffix}@example.com`,
      );
      expect((res.body as { status: string }).status).toBe(
        CandidateStatus.ACTIVE,
      );
    });

    it('accepts catalog document types and leaves historical values intact', async () => {
      for (const code of ['TI', 'CC', 'CE', 'PASSPORT'] as const) {
        const res = await request(app.getHttpServer())
          .post('/ats/candidates')
          .set(auth(recruiterToken))
          .send({
            firstName: 'Doc',
            lastName: code,
            email: `doc-${code}-${suffix}@example.com`,
            documentType: code,
          })
          .expect(201);
        expect((res.body as { documentType: string }).documentType).toBe(code);
      }

      await request(app.getHttpServer())
        .post('/ats/candidates')
        .set(auth(recruiterToken))
        .send({
          firstName: 'Doc',
          lastName: 'Bad',
          email: `doc-bad-${suffix}@example.com`,
          documentType: 'DNI',
        })
        .expect(400);

      const created = await request(app.getHttpServer())
        .post('/ats/candidates')
        .set(auth(recruiterToken))
        .send({
          firstName: 'Doc',
          lastName: 'Update',
          email: `doc-upd-${suffix}@example.com`,
          documentType: 'TI',
        })
        .expect(201);
      const id = (created.body as { id: string }).id;

      const updated = await request(app.getHttpServer())
        .patch(`/ats/candidates/${id}`)
        .set(auth(recruiterToken))
        .send({ documentType: 'CC' })
        .expect(200);
      expect((updated.body as { documentType: string }).documentType).toBe(
        'CC',
      );

      await request(app.getHttpServer())
        .patch(`/ats/candidates/${id}`)
        .set(auth(recruiterToken))
        .send({ documentType: 'DNI' })
        .expect(400);

      const historical = await prisma.candidate.create({
        data: {
          companyId: companyAId,
          firstName: 'Hist',
          lastName: 'Doc',
          email: `doc-hist-${suffix}@example.com`,
          documentType: 'Cedula',
        },
      });
      const patched = await request(app.getHttpServer())
        .patch(`/ats/candidates/${historical.id}`)
        .set(auth(recruiterToken))
        .send({ firstName: 'Historia' })
        .expect(200);
      expect((patched.body as { firstName: string }).firstName).toBe(
        'Historia',
      );
      expect((patched.body as { documentType: string }).documentType).toBe(
        'Cedula',
      );
    });

    it('rejects duplicate email in same company', async () => {
      const email = `dup-email-${suffix}@example.com`;
      await request(app.getHttpServer())
        .post('/ats/candidates')
        .set(auth(recruiterToken))
        .send({ firstName: 'One', lastName: 'A', email })
        .expect(201);

      await request(app.getHttpServer())
        .post('/ats/candidates')
        .set(auth(recruiterToken))
        .send({ firstName: 'Two', lastName: 'B', email })
        .expect(409);
    });

    it('allows same email in different tenants', async () => {
      const email = `shared-email-${suffix}@example.com`;
      await request(app.getHttpServer())
        .post('/ats/candidates')
        .set(auth(recruiterToken))
        .send({ firstName: 'A', lastName: 'Tenant', email })
        .expect(201);

      await request(app.getHttpServer())
        .post('/ats/candidates')
        .set(auth(adminBToken, companyBId))
        .send({ firstName: 'B', lastName: 'Tenant', email })
        .expect(201);
    });

    it('rejects duplicate documentNumber in same tenant', async () => {
      const doc = `DOC-${suffix}`;
      await request(app.getHttpServer())
        .post('/ats/candidates')
        .set(auth(recruiterToken))
        .send({
          firstName: 'Doc',
          lastName: 'One',
          email: `doc1-${suffix}@example.com`,
          documentNumber: doc,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/ats/candidates')
        .set(auth(recruiterToken))
        .send({
          firstName: 'Doc',
          lastName: 'Two',
          email: `doc2-${suffix}@example.com`,
          documentNumber: doc,
        })
        .expect(409);
    });

    it('search is tenant-scoped', async () => {
      const marker = `SearchMark${suffix}`;
      await request(app.getHttpServer())
        .post('/ats/candidates')
        .set(auth(recruiterToken))
        .send({
          firstName: marker,
          lastName: 'Local',
          email: `search-a-${suffix}@example.com`,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/ats/candidates')
        .set(auth(adminBToken, companyBId))
        .send({
          firstName: marker,
          lastName: 'Remote',
          email: `search-b-${suffix}@example.com`,
        })
        .expect(201);

      const listA = await request(app.getHttpServer())
        .get('/ats/candidates')
        .query({ search: marker })
        .set(auth(recruiterToken))
        .expect(200);

      const items = (listA.body as { items: { lastName: string }[] }).items;
      expect(items).toHaveLength(1);
      expect(items[0].lastName).toBe('Local');
    });

    it('rejects cross-tenant update', async () => {
      const created = await request(app.getHttpServer())
        .post('/ats/candidates')
        .set(auth(recruiterToken))
        .send({
          firstName: 'Cross',
          lastName: 'Patch',
          email: `cross-patch-${suffix}@example.com`,
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/ats/candidates/${(created.body as { id: string }).id}`)
        .set(auth(adminBToken, companyBId))
        .send({ firstName: 'Hacked' })
        .expect(404);
    });

    it('rejects arbitrary HIRED status via PATCH', async () => {
      const created = await request(app.getHttpServer())
        .post('/ats/candidates')
        .set(auth(recruiterToken))
        .send({
          firstName: 'Hire',
          lastName: 'Block',
          email: `hire-block-${suffix}@example.com`,
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/ats/candidates/${(created.body as { id: string }).id}`)
        .set(auth(recruiterToken))
        .send({ status: CandidateStatus.HIRED })
        .expect(400);
    });
  });

  describe('Application', () => {
    let candidateId = '';
    let candidate2Id = '';

    beforeAll(async () => {
      const c1 = await request(app.getHttpServer())
        .post('/ats/candidates')
        .set(auth(recruiterToken))
        .send({
          firstName: 'App',
          lastName: 'One',
          email: `app-one-${suffix}@example.com`,
        })
        .expect(201);
      candidateId = (c1.body as { id: string }).id;

      const c2 = await request(app.getHttpServer())
        .post('/ats/candidates')
        .set(auth(recruiterToken))
        .send({
          firstName: 'App',
          lastName: 'Two',
          email: `app-two-${suffix}@example.com`,
        })
        .expect(201);
      candidate2Id = (c2.body as { id: string }).id;
    });

    it('creates application with initial history', async () => {
      const created = await request(app.getHttpServer())
        .post('/ats/applications')
        .set(auth(recruiterToken))
        .send({ candidateId, vacancyId: vacancyOpenId })
        .expect(201);

      expect((created.body as { stage: string }).stage).toBe(
        ApplicationStage.PENDING_REVIEW,
      );
      expect((created.body as { status: string }).status).toBe('ACTIVE');

      const history = await request(app.getHttpServer())
        .get(`/ats/applications/${(created.body as { id: string }).id}/history`)
        .set(auth(recruiterToken))
        .expect(200);

      const rows = history.body as {
        fromStage: string | null;
        toStage: string;
      }[];
      expect(rows).toHaveLength(1);
      expect(rows[0].fromStage).toBeNull();
      expect(rows[0].toStage).toBe(ApplicationStage.PENDING_REVIEW);
    });

    it('rejects duplicate candidate/vacancy', async () => {
      await request(app.getHttpServer())
        .post('/ats/applications')
        .set(auth(recruiterToken))
        .send({ candidateId, vacancyId: vacancyOpenId })
        .expect(409);
    });

    it('allows candidate on multiple vacancies', async () => {
      await request(app.getHttpServer())
        .post(`/ats/candidates/${candidateId}/applications`)
        .set(auth(recruiterToken))
        .send({ vacancyId: vacancyOpen2Id })
        .expect(201);
    });

    it('rejects candidate from other tenant', async () => {
      const foreign = await request(app.getHttpServer())
        .post('/ats/candidates')
        .set(auth(adminBToken, companyBId))
        .send({
          firstName: 'Foreign',
          lastName: 'Cand',
          email: `foreign-cand-${suffix}@example.com`,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/ats/applications')
        .set(auth(recruiterToken))
        .send({
          candidateId: (foreign.body as { id: string }).id,
          vacancyId: vacancyOpen2Id,
        })
        .expect(404);
    });

    it('rejects vacancy from other tenant', async () => {
      await request(app.getHttpServer())
        .post('/ats/applications')
        .set(auth(recruiterToken))
        .send({ candidateId: candidate2Id, vacancyId: vacancyBId })
        .expect(404);
    });

    it('rejects CLOSED / CANCELLED / PAUSED vacancies', async () => {
      await request(app.getHttpServer())
        .post('/ats/applications')
        .set(auth(recruiterToken))
        .send({ candidateId: candidate2Id, vacancyId: vacancyClosedId })
        .expect(400);

      await request(app.getHttpServer())
        .post('/ats/applications')
        .set(auth(recruiterToken))
        .send({ candidateId: candidate2Id, vacancyId: vacancyCancelledId })
        .expect(400);

      await request(app.getHttpServer())
        .post('/ats/applications')
        .set(auth(recruiterToken))
        .send({ candidateId: candidate2Id, vacancyId: vacancyPausedId })
        .expect(400);
    });
  });

  describe('Pipeline & transitions', () => {
    let pipelineCandidateId = '';
    let applicationId = '';

    beforeAll(async () => {
      const cand = await request(app.getHttpServer())
        .post('/ats/candidates')
        .set(auth(recruiterToken))
        .send({
          firstName: 'Pipe',
          lastName: 'Line',
          email: `pipeline-${suffix}@example.com`,
        })
        .expect(201);
      pipelineCandidateId = (cand.body as { id: string }).id;

      const appRes = await request(app.getHttpServer())
        .post('/ats/applications')
        .set(auth(recruiterToken))
        .send({
          candidateId: pipelineCandidateId,
          vacancyId: vacancyOpen2Id,
        })
        .expect(201);
      applicationId = (appRes.body as { id: string }).id;
    });

    it('returns kanban columns for vacancy only', async () => {
      const pipe = await request(app.getHttpServer())
        .get(`/ats/vacancies/${vacancyOpen2Id}/pipeline`)
        .set(auth(recruiterToken))
        .expect(200);

      const body = pipe.body as {
        vacancy: { id: string };
        columns: { stage: string; count: number; applications: unknown[] }[];
      };
      expect(body.vacancy.id).toBe(vacancyOpen2Id);
      expect(body.columns).toHaveLength(7);
      const pending = body.columns.find(
        (c) => c.stage === ApplicationStage.PENDING_REVIEW,
      );
      expect(pending?.count).toBeGreaterThanOrEqual(1);
      expect(
        pending?.applications.every(
          (a) =>
            typeof a === 'object' &&
            a !== null &&
            'applicationId' in a &&
            'candidateName' in a &&
            'fitLevel' in a,
        ),
      ).toBe(true);

      const totalApps = body.columns.reduce((n, c) => n + c.count, 0);
      const listed = await request(app.getHttpServer())
        .get('/ats/applications')
        .query({ vacancyId: vacancyOpen2Id })
        .set(auth(recruiterToken))
        .expect(200);
      expect(totalApps).toBe((listed.body as { total: number }).total);
    });

    it('does not cross tenants on pipeline', async () => {
      await request(app.getHttpServer())
        .get(`/ats/vacancies/${vacancyOpen2Id}/pipeline`)
        .set(auth(adminBToken, companyBId))
        .expect(404);
    });

    it('allows happy-path stage moves to OFFER and rejects generic move to HIRED', async () => {
      const move = async (stage: ApplicationStage, expectStatus = 201) =>
        request(app.getHttpServer())
          .post(`/ats/applications/${applicationId}/move`)
          .set(auth(recruiterToken))
          .send({ stage, comment: `to ${stage}` })
          .expect(expectStatus);

      await move(ApplicationStage.CONTACTED);
      await move(ApplicationStage.INTERVIEW);
      await move(ApplicationStage.OFFER);

      const before = await prisma.vacancy.findUniqueOrThrow({
        where: { id: vacancyOpen2Id },
      });
      const candBefore = await prisma.candidate.findUniqueOrThrow({
        where: { id: pipelineCandidateId },
      });

      const hiredAttempt = await move(ApplicationStage.HIRED, 400);
      expect(JSON.stringify(hiredAttempt.body)).toMatch(/HIRED|Hiring/i);

      const after = await prisma.vacancy.findUniqueOrThrow({
        where: { id: vacancyOpen2Id },
      });
      const candAfter = await prisma.candidate.findUniqueOrThrow({
        where: { id: pipelineCandidateId },
      });
      expect(after.filledCount).toBe(before.filledCount);
      expect(candAfter.status).toBe(candBefore.status);
      expect(candAfter.status).not.toBe(CandidateStatus.HIRED);

      const applicationAfter = await prisma.application.findUniqueOrThrow({
        where: { id: applicationId },
      });
      expect(applicationAfter.stage).toBe(ApplicationStage.OFFER);

      const history = await request(app.getHttpServer())
        .get(`/ats/applications/${applicationId}/history`)
        .set(auth(recruiterToken))
        .expect(200);
      expect((history.body as unknown[]).length).toBeGreaterThanOrEqual(4);

      await request(app.getHttpServer())
        .post(`/ats/applications/${applicationId}/move`)
        .set(auth(recruiterToken))
        .send({ stage: ApplicationStage.REJECTED, comment: 'no hire' })
        .expect(201);
    });

    it('rejects invalid jump and allows reject/withdraw', async () => {
      const cand = await request(app.getHttpServer())
        .post('/ats/candidates')
        .set(auth(recruiterToken))
        .send({
          firstName: 'Jump',
          lastName: 'Test',
          email: `jump-${suffix}@example.com`,
        })
        .expect(201);

      const created = await request(app.getHttpServer())
        .post('/ats/applications')
        .set(auth(recruiterToken))
        .send({
          candidateId: (cand.body as { id: string }).id,
          vacancyId: vacancyOpenId,
        })
        .expect(201);
      const id = (created.body as { id: string }).id;

      await request(app.getHttpServer())
        .post(`/ats/applications/${id}/move`)
        .set(auth(recruiterToken))
        .send({ stage: ApplicationStage.OFFER })
        .expect(400);

      await request(app.getHttpServer())
        .post(`/ats/applications/${id}/move`)
        .set(auth(recruiterToken))
        .send({ stage: ApplicationStage.REJECTED })
        .expect(201);

      const closed = await prisma.application.findUniqueOrThrow({
        where: { id },
      });
      expect(closed.status).toBe('CLOSED');

      const withdrawCand = await request(app.getHttpServer())
        .post('/ats/candidates')
        .set(auth(recruiterToken))
        .send({
          firstName: 'With',
          lastName: 'Draw',
          email: `withdraw-${suffix}@example.com`,
        })
        .expect(201);
      const withdrawApp = await request(app.getHttpServer())
        .post('/ats/applications')
        .set(auth(recruiterToken))
        .send({
          candidateId: (withdrawCand.body as { id: string }).id,
          vacancyId: vacancyOpenId,
        })
        .expect(201);
      await request(app.getHttpServer())
        .post(
          `/ats/applications/${(withdrawApp.body as { id: string }).id}/move`,
        )
        .set(auth(recruiterToken))
        .send({ stage: ApplicationStage.WITHDRAWN })
        .expect(201);
    });

    it('protects concurrent stage moves', async () => {
      const cand = await request(app.getHttpServer())
        .post('/ats/candidates')
        .set(auth(recruiterToken))
        .send({
          firstName: 'Race',
          lastName: 'Cond',
          email: `race-${suffix}@example.com`,
        })
        .expect(201);
      const created = await request(app.getHttpServer())
        .post('/ats/applications')
        .set(auth(recruiterToken))
        .send({
          candidateId: (cand.body as { id: string }).id,
          vacancyId: vacancyOpenId,
        })
        .expect(201);
      const id = (created.body as { id: string }).id;

      const recruiter = await prisma.user.findUniqueOrThrow({
        where: { email: `cand-recruiter-${suffix}@example.com` },
      });
      const admin = await prisma.user.findUniqueOrThrow({
        where: { email: `cand-admin-${suffix}@example.com` },
      });
      const applicationsService = app.get(ApplicationsService);

      const results = await Promise.allSettled([
        applicationsService.move(companyAId, recruiter.id, id, {
          stage: ApplicationStage.CONTACTED,
        }),
        applicationsService.move(companyAId, admin.id, id, {
          stage: ApplicationStage.CONTACTED,
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      const err = rejected[0].reason as ConflictException;
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getStatus()).toBe(409);
    });
  });

  describe('RBAC', () => {
    it('recruiter can manage; leader read-only; collaborator denied', async () => {
      await request(app.getHttpServer())
        .get('/ats/candidates')
        .set(auth(leaderToken))
        .expect(200);

      await request(app.getHttpServer())
        .post('/ats/candidates')
        .set(auth(leaderToken))
        .send({
          firstName: 'No',
          lastName: 'Write',
          email: `leader-write-${suffix}@example.com`,
        })
        .expect(403);

      await request(app.getHttpServer())
        .get('/ats/applications')
        .set(auth(leaderToken))
        .expect(200);

      await request(app.getHttpServer())
        .get('/ats/candidates')
        .set(auth(collaboratorToken))
        .expect(403);

      await request(app.getHttpServer())
        .get('/ats/applications')
        .set(auth(collaboratorToken))
        .expect(403);
    });

    it('requires JWT and tenant header', async () => {
      await request(app.getHttpServer()).get('/ats/candidates').expect(401);

      await request(app.getHttpServer())
        .get('/ats/candidates')
        .set({ Authorization: `Bearer ${recruiterToken}` })
        .expect(403);
    });
  });
});
