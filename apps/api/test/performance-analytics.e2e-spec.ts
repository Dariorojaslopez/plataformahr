import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  CompanyStatus,
  EmployeeStatus,
  MembershipStatus,
  PerformanceResultStatus,
  PrismaClient,
  ReportingLineType,
  RoleScope,
  UserStatus,
} from '@prisma/client';
import { join } from 'node:path';
import { loadOptionalEnvFile } from './load-env';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PasswordHashingService } from '../src/auth/password-hashing.service';

loadOptionalEnvFile(join(__dirname, '../.env'));

type AssignedParticipant = {
  id: string;
  evaluations: Array<{
    id: string;
    type: string;
  }>;
};

type OrgBreakdownRow = {
  id: string | null;
  name: string;
  resultCount: number;
  averageScore: number | null;
};

type AnalyticsBody = {
  cycle: { id: string; status: string };
  participants: {
    totalParticipants: number;
    activeParticipants: number;
    completedParticipants: number;
    excludedParticipants: number;
    eligibleParticipants: number;
    completionRate: number;
  };
  evaluations: {
    self: { total: number; submitted: number };
    manager: { total: number; submitted: number };
  };
  results: {
    calculatedResults: number;
    releasedResults: number;
    totalResults: number;
    releasedRate: number;
    averageScore: number | null;
    minScore: number | null;
    maxScore: number | null;
    scorePopulation: string;
  };
  distribution: Array<{ key: string; count: number; percentage: number }>;
  byArea: OrgBreakdownRow[];
  byPosition: OrgBreakdownRow[];
  byBusinessUnit: OrgBreakdownRow[];
};

type ResultsListBody = {
  items: Array<{
    status: string;
    areaSnapshot: { id: string | null };
  }>;
  total: number;
};

describe('Performance analytics (08E)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let hasher: PasswordHashingService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const password = `AnPass-${suffix}!`;

  let companyAId = '';
  let companyBId = '';
  let areaAId = '';
  let areaBId = '';
  let positionAId = '';
  let businessUnitAId = '';
  let adminToken = '';
  let adminBToken = '';
  let leaderToken = '';
  let collabToken = '';
  let perfManagerToken = '';
  let recruiterToken = '';

  let employeeAId = '';
  let employeeBId = '';
  let employeeNoMgrId = '';
  let employeeFormulaId = '';
  let scale15Id = '';
  let competencyBaseId = '';

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

  const createScale = async (name: string) => {
    const scale = await request(app.getHttpServer())
      .post('/performance/scales')
      .set(auth(adminToken))
      .send({ name })
      .expect(201);
    const scaleId = (scale.body as { id: string }).id;
    for (const v of [1, 2, 3, 4, 5]) {
      await request(app.getHttpServer())
        .post(`/performance/scales/${scaleId}/levels`)
        .set(auth(adminToken))
        .send({ value: v, label: `N${v}`, order: v })
        .expect(201);
    }
    return scaleId;
  };

  const createActiveCycle = async (name: string) => {
    const cycle = await request(app.getHttpServer())
      .post('/performance/cycles')
      .set(auth(adminToken))
      .send({
        name,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        selfEvaluationWeight: 30,
        managerEvaluationWeight: 70,
      })
      .expect(201);
    const cycleId = (cycle.body as { id: string }).id;
    await request(app.getHttpServer())
      .post(`/performance/cycles/${cycleId}/competencies`)
      .set(auth(adminToken))
      .send({
        competencyId: competencyBaseId,
        scaleId: scale15Id,
        weight: null,
        order: 0,
        required: true,
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/performance/cycles/${cycleId}/activate`)
      .set(auth(adminToken))
      .expect(201);
    return cycleId;
  };

  const assignParticipant = async (cycleId: string, employeeId: string) => {
    const res = await request(app.getHttpServer())
      .post(`/performance/cycles/${cycleId}/participants`)
      .set(auth(adminToken))
      .send({ employeeId })
      .expect(201);
    return res.body as AssignedParticipant;
  };

  const setEvalScore = async (evaluationId: string, score: number) => {
    await prisma.performanceEvaluation.update({
      where: { id: evaluationId },
      data: {
        status: 'SUBMITTED',
        scorePercentage: score,
        submittedAt: new Date(),
      },
    });
  };

  const submitAllEvals = async (participant: AssignedParticipant) => {
    for (const evaluation of participant.evaluations) {
      await setEvalScore(evaluation.id, evaluation.type === 'SELF' ? 80 : 90);
    }
  };

  const calculateResult = (cycleId: string, participantId: string) =>
    request(app.getHttpServer())
      .post(
        `/performance/cycles/${cycleId}/participants/${participantId}/result/calculate`,
      )
      .set(auth(adminToken));

  const releaseResult = (cycleId: string, participantId: string) =>
    request(app.getHttpServer())
      .post(
        `/performance/cycles/${cycleId}/participants/${participantId}/result/release`,
      )
      .set(auth(adminToken));

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
        name: `An A ${suffix}`,
        slug: `an-a-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    const companyB = await prisma.company.create({
      data: {
        name: `An B ${suffix}`,
        slug: `an-b-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    companyAId = companyA.id;
    companyBId = companyB.id;

    const bu = await prisma.businessUnit.create({
      data: { companyId: companyAId, name: `An BU ${suffix}` },
    });
    businessUnitAId = bu.id;
    const area = await prisma.area.create({
      data: {
        companyId: companyAId,
        businessUnitId: bu.id,
        name: `An Area A ${suffix}`,
      },
    });
    areaAId = area.id;
    const areaB = await prisma.area.create({
      data: {
        companyId: companyAId,
        businessUnitId: bu.id,
        name: `An Area B ${suffix}`,
      },
    });
    areaBId = areaB.id;
    const jl = await prisma.jobLevel.create({
      data: {
        companyId: companyAId,
        name: `An JL ${suffix}`,
        rank: 6000 + Math.floor(Math.random() * 500),
      },
    });
    const position = await prisma.position.create({
      data: {
        companyId: companyAId,
        areaId: areaAId,
        jobLevelId: jl.id,
        name: `An Pos ${suffix}`,
        headcount: 50,
      },
    });
    positionAId = position.id;

    const permissions = [
      'performance.cycle.read',
      'performance.cycle.manage',
      'performance.competency.read',
      'performance.competency.manage',
      'performance.scale.read',
      'performance.scale.manage',
      'performance.evaluation.read',
      'performance.evaluation.manage',
      'performance.evaluation.respond',
      'performance.result.read',
      'performance.result.manage',
      'performance.result.release',
      'performance.analytics.read',
    ] as const;

    const permissionIds = new Map<string, string>();
    for (const code of permissions) {
      const saved = await prisma.permission.upsert({
        where: { code },
        create: { code, name: code, description: 'x' },
        update: {},
      });
      permissionIds.set(code, saved.id);
    }

    const all = [...permissions];
    const byRole: Record<string, string[]> = {
      CLIENT_ADMIN: all,
      PERFORMANCE_MANAGER: all,
      LEADER: [
        'performance.cycle.read',
        'performance.competency.read',
        'performance.scale.read',
        'performance.evaluation.read',
        'performance.evaluation.respond',
      ],
      COLLABORATOR: [
        'performance.cycle.read',
        'performance.competency.read',
        'performance.scale.read',
        'performance.evaluation.read',
        'performance.evaluation.respond',
      ],
    };

    for (const [roleCode, codes] of Object.entries(byRole)) {
      const role = await prisma.role.findUniqueOrThrow({
        where: { scope_code: { scope: RoleScope.COMPANY, code: roleCode } },
      });
      for (const code of codes) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permissionIds.get(code)!,
            },
          },
          create: {
            roleId: role.id,
            permissionId: permissionIds.get(code)!,
          },
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
          firstName: 'An',
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
      `an-admin-${suffix}@example.com`,
      'CLIENT_ADMIN',
      companyAId,
    );
    await createUser(
      `an-pm-${suffix}@example.com`,
      'PERFORMANCE_MANAGER',
      companyAId,
    );
    const leaderUser = await createUser(
      `an-leader-${suffix}@example.com`,
      'LEADER',
      companyAId,
    );
    const collabUser = await createUser(
      `an-collab-${suffix}@example.com`,
      'COLLABORATOR',
      companyAId,
    );
    const managerUser = await createUser(
      `an-manager-${suffix}@example.com`,
      'LEADER',
      companyAId,
    );
    await createUser(
      `an-admin-b-${suffix}@example.com`,
      'CLIENT_ADMIN',
      companyBId,
    );
    await createUser(
      `an-recruiter-${suffix}@example.com`,
      'RECRUITER',
      companyAId,
    );

    const createEmp = async (
      firstName: string,
      email: string,
      userId?: string,
    ) =>
      prisma.employee.create({
        data: {
          companyId: companyAId,
          firstName,
          lastName: 'Analytics',
          email,
          areaId: areaAId,
          positionId: positionAId,
          businessUnitId: businessUnitAId,
          status: EmployeeStatus.ACTIVE,
          ...(userId ? { userId } : {}),
        },
      });

    const empA = await createEmp(
      'Alice',
      `an-alice-${suffix}@example.com`,
      collabUser.id,
    );
    const empB = await createEmp(
      'Bob',
      `an-bob-${suffix}@example.com`,
      managerUser.id,
    );
    const empNoMgr = await createEmp(
      'Solo',
      `an-solo-${suffix}@example.com`,
      leaderUser.id,
    );
    const empFormula = await createEmp(
      '=HYPERLINK("http://evil")',
      `an-formula-${suffix}@example.com`,
    );
    employeeAId = empA.id;
    employeeBId = empB.id;
    employeeNoMgrId = empNoMgr.id;
    employeeFormulaId = empFormula.id;

    await prisma.employeeReportingLine.create({
      data: {
        companyId: companyAId,
        employeeId: employeeAId,
        managerEmployeeId: employeeBId,
        type: ReportingLineType.DIRECT,
      },
    });

    adminToken = await login(`an-admin-${suffix}@example.com`);
    perfManagerToken = await login(`an-pm-${suffix}@example.com`);
    leaderToken = await login(`an-leader-${suffix}@example.com`);
    collabToken = await login(`an-collab-${suffix}@example.com`);
    await login(`an-manager-${suffix}@example.com`);
    adminBToken = await login(`an-admin-b-${suffix}@example.com`);
    recruiterToken = await login(`an-recruiter-${suffix}@example.com`);

    scale15Id = await createScale(`An Scale ${suffix}`);
    const competency = await request(app.getHttpServer())
      .post('/performance/competencies')
      .set(auth(adminToken))
      .send({ name: `An Comp ${suffix}`, code: `AN-${suffix.slice(0, 6)}` })
      .expect(201);
    competencyBaseId = (competency.body as { id: string }).id;
  });

  afterEach(async () => {
    if (!employeeAId || !areaAId) return;
    await prisma.employee.update({
      where: { id: employeeAId },
      data: { areaId: areaAId },
    });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('returns empty analytics for cycle without participants', async () => {
    const cycleId = await createActiveCycle(`Empty ${suffix}`);
    const res = await request(app.getHttpServer())
      .get(`/performance/cycles/${cycleId}/analytics`)
      .set(auth(adminToken))
      .expect(200);

    const body = res.body as AnalyticsBody;
    expect(body.participants).toMatchObject({
      totalParticipants: 0,
      completionRate: 0,
    });
    expect(body.results.averageScore).toBeNull();
    expect(body.results.minScore).toBeNull();
    expect(body.results.maxScore).toBeNull();
  });

  it('computes participant/evaluation/result metrics and org snapshots', async () => {
    const cycleId = await createActiveCycle(`Metrics ${suffix}`);

    const pA = await assignParticipant(cycleId, employeeAId);
    const pB = await assignParticipant(cycleId, employeeBId);
    const pNoMgr = await assignParticipant(cycleId, employeeNoMgrId);
    const pExcluded = await assignParticipant(cycleId, employeeFormulaId);

    expect(pA.evaluations.some((e) => e.type === 'MANAGER')).toBe(true);
    expect(pNoMgr.evaluations.some((e) => e.type === 'MANAGER')).toBe(false);

    await request(app.getHttpServer())
      .post(
        `/performance/cycles/${cycleId}/participants/${pExcluded.id}/exclude`,
      )
      .set(auth(adminToken))
      .expect(201);

    await submitAllEvals(pA);
    await submitAllEvals(pB);
    for (const evaluation of pNoMgr.evaluations) {
      await setEvalScore(evaluation.id, 100);
    }

    await calculateResult(cycleId, pA.id).expect(201);
    const resultA = await prisma.performanceResult.findUniqueOrThrow({
      where: { participantId: pA.id },
    });
    expect(resultA.areaIdSnapshot).toBe(areaAId);
    expect(resultA.areaNameSnapshot).toContain('An Area A');
    expect(resultA.positionIdSnapshot).toBe(positionAId);
    expect(resultA.businessUnitIdSnapshot).toBe(businessUnitAId);

    await calculateResult(cycleId, pB.id).expect(201);
    await releaseResult(cycleId, pB.id).expect(201);

    // Move employee A after calculate — historical analytics must stay on Area A.
    await prisma.employee.update({
      where: { id: employeeAId },
      data: { areaId: areaBId },
    });

    const analytics = await request(app.getHttpServer())
      .get(`/performance/cycles/${cycleId}/analytics`)
      .set(auth(adminToken))
      .expect(200);

    const body = analytics.body as AnalyticsBody;
    expect(body.participants).toMatchObject({
      totalParticipants: 4,
      activeParticipants: 1,
      completedParticipants: 2,
      excludedParticipants: 1,
      eligibleParticipants: 3,
      completionRate: 66.67,
    });

    // Only Alice has DIRECT manager → one MANAGER evaluation vs four SELF.
    expect(body.evaluations.self.total).toBe(4);
    expect(body.evaluations.manager.total).toBe(1);
    expect(body.evaluations.self.submitted).toBeGreaterThanOrEqual(3);
    expect(body.evaluations.manager.total).toBeLessThan(
      body.evaluations.self.total,
    );

    expect(body.results).toMatchObject({
      calculatedResults: 1,
      releasedResults: 1,
      totalResults: 2,
      releasedRate: 50,
      scorePopulation: 'CALCULATED_AND_RELEASED',
    });
    expect(body.results.averageScore).toBeTruthy();
    expect(body.results.minScore).not.toBeNull();
    expect(body.results.maxScore).not.toBeNull();

    const areaABucket = body.byArea.find((r) => r.id === areaAId);
    expect(areaABucket?.resultCount).toBeGreaterThanOrEqual(1);
    expect(body.byArea.some((r) => r.id === areaBId)).toBe(false);

    expect(body.byPosition[0]?.id).toBe(positionAId);
    expect(body.byBusinessUnit[0]?.id).toBe(businessUnitAId);

    const dist = body.distribution;
    expect(dist).toHaveLength(5);
    expect(dist.map((d) => d.key)).toEqual([
      '0-20',
      '20-40',
      '40-60',
      '60-80',
      '80-100',
    ]);
    expect(dist.reduce((sum, d) => sum + d.count, 0)).toBe(2);

    // Restore employee area for later tests.
    await prisma.employee.update({
      where: { id: employeeAId },
      data: { areaId: areaAId },
    });
  });

  it('groups legacy null org snapshot as Sin área', async () => {
    const cycleId = await createActiveCycle(`Legacy ${suffix}`);
    const p = await assignParticipant(cycleId, employeeNoMgrId);
    for (const evaluation of p.evaluations) {
      await setEvalScore(evaluation.id, 50);
    }
    await calculateResult(cycleId, p.id).expect(201);
    await prisma.performanceResult.update({
      where: { participantId: p.id },
      data: {
        areaIdSnapshot: null,
        areaNameSnapshot: null,
        overallScore: 19.99,
      },
    });

    const analytics = await request(app.getHttpServer())
      .get(`/performance/cycles/${cycleId}/analytics`)
      .set(auth(adminToken))
      .expect(200);

    const body = analytics.body as AnalyticsBody;
    expect(body.byArea.some((r) => r.id == null && r.name === 'Sin área')).toBe(
      true,
    );
    const bucket = body.distribution.find((d) => d.key === '0-20');
    expect(bucket?.count).toBeGreaterThanOrEqual(1);
  });

  it('enforces analytics RBAC and cross-tenant 404', async () => {
    const cycleId = await createActiveCycle(`RBAC ${suffix}`);

    await request(app.getHttpServer())
      .get(`/performance/cycles/${cycleId}/analytics`)
      .set(auth(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .get(`/performance/cycles/${cycleId}/analytics`)
      .set(auth(perfManagerToken))
      .expect(200);
    await request(app.getHttpServer())
      .get(`/performance/cycles/${cycleId}/analytics`)
      .set(auth(leaderToken))
      .expect(403);
    await request(app.getHttpServer())
      .get(`/performance/cycles/${cycleId}/analytics`)
      .set(auth(collabToken))
      .expect(403);
    await request(app.getHttpServer())
      .get(`/performance/cycles/${cycleId}/analytics`)
      .set(auth(recruiterToken))
      .expect(403);
    await request(app.getHttpServer())
      .get(`/performance/cycles/${cycleId}/analytics`)
      .set(auth(adminBToken, companyBId))
      .expect(404);
  });

  it('allows analytics on CLOSED cycle', async () => {
    const cycleId = await createActiveCycle(`Closed ${suffix}`);
    const p = await assignParticipant(cycleId, employeeNoMgrId);
    for (const evaluation of p.evaluations) {
      await setEvalScore(evaluation.id, 70);
    }
    await calculateResult(cycleId, p.id).expect(201);
    await request(app.getHttpServer())
      .post(`/performance/cycles/${cycleId}/close`)
      .set(auth(adminToken))
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/performance/cycles/${cycleId}/analytics`)
      .set(auth(adminToken))
      .expect(200);
    const body = res.body as AnalyticsBody;
    expect(body.cycle.status).toBe('CLOSED');
    expect(body.results.totalResults).toBe(1);
  });

  it('filters admin results by cycle/status/org snapshot and paginates', async () => {
    const cycleId = await createActiveCycle(`Report ${suffix}`);
    const pA = await assignParticipant(cycleId, employeeAId);
    await submitAllEvals(pA);
    await calculateResult(cycleId, pA.id).expect(201);
    await releaseResult(cycleId, pA.id).expect(201);

    const byCycle = await request(app.getHttpServer())
      .get(`/performance/results?cycleId=${cycleId}&page=1&limit=1`)
      .set(auth(adminToken))
      .expect(200);
    const byCycleBody = byCycle.body as ResultsListBody;
    expect(byCycleBody.items).toHaveLength(1);
    expect(byCycleBody.total).toBe(1);
    expect(byCycleBody.items[0]?.areaSnapshot.id).toBe(areaAId);

    const byStatus = await request(app.getHttpServer())
      .get(`/performance/results?cycleId=${cycleId}&status=RELEASED`)
      .set(auth(adminToken))
      .expect(200);
    const byStatusBody = byStatus.body as ResultsListBody;
    expect(byStatusBody.items.every((i) => i.status === 'RELEASED')).toBe(true);

    const byArea = await request(app.getHttpServer())
      .get(`/performance/results?cycleId=${cycleId}&areaId=${areaAId}`)
      .set(auth(adminToken))
      .expect(200);
    expect((byArea.body as ResultsListBody).total).toBe(1);

    const byPos = await request(app.getHttpServer())
      .get(`/performance/results?cycleId=${cycleId}&positionId=${positionAId}`)
      .set(auth(adminToken))
      .expect(200);
    expect((byPos.body as ResultsListBody).total).toBe(1);

    const byBu = await request(app.getHttpServer())
      .get(
        `/performance/results?cycleId=${cycleId}&businessUnitId=${businessUnitAId}`,
      )
      .set(auth(adminToken))
      .expect(200);
    expect((byBu.body as ResultsListBody).total).toBe(1);

    const wrongArea = await request(app.getHttpServer())
      .get(`/performance/results?cycleId=${cycleId}&areaId=${areaBId}`)
      .set(auth(adminToken))
      .expect(200);
    expect((wrongArea.body as ResultsListBody).total).toBe(0);
  });

  it('exports CSV with filters, UTF-8 BOM, escaping and formula protection', async () => {
    const cycleId = await createActiveCycle(`CSV ${suffix}`);
    const pFormula = await assignParticipant(cycleId, employeeFormulaId);
    for (const evaluation of pFormula.evaluations) {
      await setEvalScore(evaluation.id, 88);
    }
    await calculateResult(cycleId, pFormula.id).expect(201);

    const exportRes = await request(app.getHttpServer())
      .get(`/performance/results/export?cycleId=${cycleId}&areaId=${areaAId}`)
      .set(auth(adminToken))
      .expect(200);

    expect(exportRes.headers['content-type']).toMatch(/text\/csv/);
    expect(exportRes.headers['content-disposition']).toMatch(
      /attachment; filename="resultados-desempeno-/,
    );

    const body =
      typeof exportRes.text === 'string'
        ? exportRes.text
        : Buffer.isBuffer(exportRes.body)
          ? exportRes.body.toString('utf8')
          : String(exportRes.body);

    expect(body.charCodeAt(0)).toBe(0xfeff);
    expect(body).toContain('Colaborador');
    expect(body).toContain('Autoevaluación');
    expect(body).toContain("'=HYPERLINK(");
    expect(body).not.toMatch(/(^|,)=HYPERLINK/m);
    expect(body).not.toContain('comment');
    expect(body).not.toContain('responses');
    expect(body).not.toContain('selectedScaleLevelId');

    await request(app.getHttpServer())
      .get(`/performance/results/export?cycleId=${cycleId}`)
      .set(auth(leaderToken))
      .expect(403);

    await request(app.getHttpServer())
      .get(`/performance/results/export?cycleId=${cycleId}`)
      .set(auth(adminBToken, companyBId))
      .expect(200)
      .expect((res) => {
        const text =
          typeof res.text === 'string' ? res.text : String(res.body ?? '');
        // Tenant B has no matching rows for cycle of A (or empty after company filter).
        expect(text).not.toContain(`an-formula-${suffix}@example.com`);
      });
  });

  it('includes CALCULATED in average and preserves 08D manager privacy on mine', async () => {
    const cycleId = await createActiveCycle(`Avg ${suffix}`);
    const pA = await assignParticipant(cycleId, employeeAId);
    await submitAllEvals(pA);
    await calculateResult(cycleId, pA.id).expect(201);

    const analytics = await request(app.getHttpServer())
      .get(`/performance/cycles/${cycleId}/analytics`)
      .set(auth(adminToken))
      .expect(200);
    const analyticsBody = analytics.body as AnalyticsBody;
    expect(analyticsBody.results.calculatedResults).toBe(1);
    expect(analyticsBody.results.averageScore).not.toBeNull();

    const mine = await request(app.getHttpServer())
      .get('/performance/results/mine')
      .set(auth(collabToken))
      .expect(200);
    const mineItems = (mine.body as { items: Array<{ cycle: { id: string } }> })
      .items;
    expect(mineItems.every((i) => i.cycle.id !== cycleId)).toBe(true);

    const result = await prisma.performanceResult.findFirstOrThrow({
      where: { cycleId, employeeId: employeeAId },
    });
    await prisma.performanceResult.update({
      where: { id: result.id },
      data: {
        status: PerformanceResultStatus.RELEASED,
        releasedAt: new Date(),
      },
    });

    const mineReleased = await request(app.getHttpServer())
      .get('/performance/results/mine')
      .set(auth(collabToken))
      .expect(200);
    const releasedItems = (
      mineReleased.body as {
        items: Array<{ id: string; managerScore?: unknown }>;
      }
    ).items;
    const item = releasedItems.find((i) => i.id === result.id);
    expect(item).toBeTruthy();
    expect(item).not.toHaveProperty('managerScore');
  });
});
