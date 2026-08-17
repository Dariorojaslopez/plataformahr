import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  CompanyStatus,
  EmployeeStatus,
  MembershipStatus,
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
import { PERFORMANCE_AUDIT } from '../src/performance/performance.constants';

loadOptionalEnvFile(join(__dirname, '../.env'));

type SnapshotCompetency = {
  id: string;
  name: string;
  required: boolean;
  weight: string | null;
  levels: Array<{ id: string; value: number; label: string; order: number }>;
  response: {
    selectedScaleLevelId: string;
    ratingValue: number;
    comment: string | null;
  } | null;
};

type AssignedParticipant = {
  id: string;
  evaluations: Array<{
    id: string;
    type: string;
    competencies: SnapshotCompetency[];
  }>;
};

describe('Performance results (08D)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let hasher: PasswordHashingService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const password = `ResPass-${suffix}!`;

  let companyAId = '';
  let companyBId = '';
  let areaAId = '';
  let positionAId = '';
  let adminToken = '';
  let adminBToken = '';
  let leaderToken = '';
  let collabToken = '';
  let managerToken = '';
  let perfManagerToken = '';
  let recruiterToken = '';

  let employeeAId = '';
  let employeeBId = '';
  let employeeNoMgrId = '';
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

  const createScale = async (
    name: string,
    levels: Array<{ value: number; label: string; order: number }>,
  ) => {
    const scale = await request(app.getHttpServer())
      .post('/performance/scales')
      .set(auth(adminToken))
      .send({ name })
      .expect(201);
    const scaleId = (scale.body as { id: string }).id;
    for (const level of levels) {
      await request(app.getHttpServer())
        .post(`/performance/scales/${scaleId}/levels`)
        .set(auth(adminToken))
        .send(level)
        .expect(201);
    }
    return scaleId;
  };

  const createCompetency = async (name: string, code: string) => {
    const res = await request(app.getHttpServer())
      .post('/performance/competencies')
      .set(auth(adminToken))
      .send({ name, code })
      .expect(201);
    return (res.body as { id: string }).id;
  };

  const createDraftCycle = (
    name: string,
    weights?: { self: number; manager: number },
  ) =>
    request(app.getHttpServer())
      .post('/performance/cycles')
      .set(auth(adminToken))
      .send({
        name,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        ...(weights
          ? {
              selfEvaluationWeight: weights.self,
              managerEvaluationWeight: weights.manager,
            }
          : {}),
      });

  const addCompetencies = async (
    cycleId: string,
    assignments: Array<{
      competencyId: string;
      scaleId: string;
      weight?: number | null;
      order?: number;
      required?: boolean;
    }>,
  ) => {
    for (const [index, assignment] of assignments.entries()) {
      await request(app.getHttpServer())
        .post(`/performance/cycles/${cycleId}/competencies`)
        .set(auth(adminToken))
        .send({
          competencyId: assignment.competencyId,
          scaleId: assignment.scaleId,
          weight: assignment.weight ?? null,
          order: assignment.order ?? index,
          required: assignment.required ?? true,
        })
        .expect(201);
    }
  };

  const activateCycle = (cycleId: string) =>
    request(app.getHttpServer())
      .post(`/performance/cycles/${cycleId}/activate`)
      .set(auth(adminToken));

  const createActiveCycle = async (
    name: string,
    assignments: Array<{
      competencyId: string;
      scaleId: string;
      weight?: number | null;
      order?: number;
      required?: boolean;
    }>,
    weights?: { self: number; manager: number },
  ) => {
    const cycle = await createDraftCycle(name, weights).expect(201);
    const cycleId = (cycle.body as { id: string }).id;
    await addCompetencies(cycleId, assignments);
    await activateCycle(cycleId).expect(201);
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

  const putResponse = (
    evaluationId: string,
    competencyId: string,
    token: string,
    body: { scaleLevelId: string; comment?: string | null },
  ) =>
    request(app.getHttpServer())
      .put(
        `/performance/evaluations/${evaluationId}/competencies/${competencyId}/response`,
      )
      .set(auth(token))
      .send(body);

  const levelByValue = (comp: SnapshotCompetency, value: number) => {
    const level = comp.levels.find((l) => l.value === value);
    if (!level) {
      throw new Error(`Level value ${value} not found on ${comp.name}`);
    }
    return level;
  };

  const submitAllLevels = async (
    evaluation: AssignedParticipant['evaluations'][number],
    token: string,
    ratingValue = 4,
  ) => {
    for (const comp of evaluation.competencies) {
      await putResponse(evaluation.id, comp.id, token, {
        scaleLevelId: levelByValue(comp, ratingValue).id,
      }).expect(200);
    }
    await request(app.getHttpServer())
      .post(`/performance/evaluations/${evaluation.id}/submit`)
      .set(auth(token))
      .expect(201);
  };

  const setEvalScore = async (evaluationId: string, score: number) => {
    await prisma.performanceEvaluation.update({
      where: { id: evaluationId },
      data: { scorePercentage: score },
    });
  };

  const calculateResult = (
    cycleId: string,
    participantId: string,
    token: string,
  ) =>
    request(app.getHttpServer())
      .post(
        `/performance/cycles/${cycleId}/participants/${participantId}/result/calculate`,
      )
      .set(auth(token));

  const releaseResult = (
    cycleId: string,
    participantId: string,
    token: string,
  ) =>
    request(app.getHttpServer())
      .post(
        `/performance/cycles/${cycleId}/participants/${participantId}/result/release`,
      )
      .set(auth(token));

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
        name: `Res A ${suffix}`,
        slug: `res-a-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    const companyB = await prisma.company.create({
      data: {
        name: `Res B ${suffix}`,
        slug: `res-b-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    companyAId = companyA.id;
    companyBId = companyB.id;

    const bu = await prisma.businessUnit.create({
      data: { companyId: companyAId, name: `Res BU ${suffix}` },
    });
    const area = await prisma.area.create({
      data: {
        companyId: companyAId,
        businessUnitId: bu.id,
        name: `Res Area ${suffix}`,
      },
    });
    areaAId = area.id;
    const jl = await prisma.jobLevel.create({
      data: {
        companyId: companyAId,
        name: `Res JL ${suffix}`,
        rank: 5000 + Math.floor(Math.random() * 500),
      },
    });
    const position = await prisma.position.create({
      data: {
        companyId: companyAId,
        areaId: areaAId,
        jobLevelId: jl.id,
        name: `Res Pos ${suffix}`,
        headcount: 50,
      },
    });
    positionAId = position.id;

    const permissions = [
      {
        code: 'performance.cycle.read',
        name: 'Read cycles',
        description: 'x',
      },
      {
        code: 'performance.cycle.manage',
        name: 'Manage cycles',
        description: 'x',
      },
      {
        code: 'performance.competency.read',
        name: 'Read comps',
        description: 'x',
      },
      {
        code: 'performance.competency.manage',
        name: 'Manage comps',
        description: 'x',
      },
      {
        code: 'performance.scale.read',
        name: 'Read scales',
        description: 'x',
      },
      {
        code: 'performance.scale.manage',
        name: 'Manage scales',
        description: 'x',
      },
      {
        code: 'performance.evaluation.read',
        name: 'Read evals',
        description: 'x',
      },
      {
        code: 'performance.evaluation.manage',
        name: 'Manage evals',
        description: 'x',
      },
      {
        code: 'performance.evaluation.respond',
        name: 'Respond evals',
        description: 'x',
      },
      {
        code: 'performance.result.read',
        name: 'Read results',
        description: 'x',
      },
      {
        code: 'performance.result.manage',
        name: 'Manage results',
        description: 'x',
      },
      {
        code: 'performance.result.release',
        name: 'Release results',
        description: 'x',
      },
    ] as const;

    const permissionIds = new Map<string, string>();
    for (const p of permissions) {
      const saved = await prisma.permission.upsert({
        where: { code: p.code },
        create: { ...p },
        update: { name: p.name, description: p.description },
      });
      permissionIds.set(p.code, saved.id);
    }

    const all = permissions.map((p) => p.code);
    const byRole: Record<string, string[]> = {
      CLIENT_ADMIN: [...all],
      PERFORMANCE_MANAGER: [...all],
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
          firstName: 'Res',
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
      `res-admin-${suffix}@example.com`,
      'CLIENT_ADMIN',
      companyAId,
    );
    await createUser(
      `res-pm-${suffix}@example.com`,
      'PERFORMANCE_MANAGER',
      companyAId,
    );
    const leaderUser = await createUser(
      `res-leader-${suffix}@example.com`,
      'LEADER',
      companyAId,
    );
    const collabUser = await createUser(
      `res-collab-${suffix}@example.com`,
      'COLLABORATOR',
      companyAId,
    );
    const managerUser = await createUser(
      `res-manager-${suffix}@example.com`,
      'LEADER',
      companyAId,
    );
    await createUser(
      `res-admin-b-${suffix}@example.com`,
      'CLIENT_ADMIN',
      companyBId,
    );
    await createUser(
      `res-recruiter-${suffix}@example.com`,
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
          lastName: 'Res',
          email,
          areaId: areaAId,
          positionId: positionAId,
          status: EmployeeStatus.ACTIVE,
          ...(userId ? { userId } : {}),
        },
      });

    const empA = await createEmp(
      'Alice',
      `res-alice-${suffix}@example.com`,
      collabUser.id,
    );
    const empB = await createEmp(
      'Bob',
      `res-bob-${suffix}@example.com`,
      managerUser.id,
    );
    const empNoMgr = await createEmp(
      'Solo',
      `res-solo-${suffix}@example.com`,
      leaderUser.id,
    );
    employeeAId = empA.id;
    employeeBId = empB.id;
    employeeNoMgrId = empNoMgr.id;

    await prisma.employeeReportingLine.create({
      data: {
        companyId: companyAId,
        employeeId: employeeAId,
        managerEmployeeId: employeeBId,
        type: ReportingLineType.DIRECT,
      },
    });

    adminToken = await login(`res-admin-${suffix}@example.com`);
    perfManagerToken = await login(`res-pm-${suffix}@example.com`);
    leaderToken = await login(`res-leader-${suffix}@example.com`);
    collabToken = await login(`res-collab-${suffix}@example.com`);
    managerToken = await login(`res-manager-${suffix}@example.com`);
    adminBToken = await login(`res-admin-b-${suffix}@example.com`);
    recruiterToken = await login(`res-recruiter-${suffix}@example.com`);

    scale15Id = await createScale(
      `Escala 1-5 ${suffix}`,
      [1, 2, 3, 4, 5].map((v) => ({
        value: v,
        label: `N${v}`,
        order: v,
      })),
    );
    competencyBaseId = await createCompetency(
      `Base Comp ${suffix}`,
      `BASE-${suffix.slice(0, 6)}`,
    );
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('rejects invalid evaluator weight sum and accepts/activates 30/70', async () => {
    const invalidCreate = await createDraftCycle(`Bad sum create ${suffix}`, {
      self: 40,
      manager: 40,
    });
    expect(invalidCreate.status).toBe(400);

    const draft = await createDraftCycle(`Draft weights ${suffix}`).expect(201);
    const draftId = (draft.body as { id: string }).id;

    await request(app.getHttpServer())
      .patch(`/performance/cycles/${draftId}`)
      .set(auth(adminToken))
      .send({ selfEvaluationWeight: 40, managerEvaluationWeight: 40 })
      .expect(400);

    const okCreate = await createDraftCycle(`Ok 30/70 ${suffix}`, {
      self: 30,
      manager: 70,
    }).expect(201);
    expect(okCreate.body).toMatchObject({
      selfEvaluationWeight: '30.00',
      managerEvaluationWeight: '70.00',
    });

    await request(app.getHttpServer())
      .patch(`/performance/cycles/${draftId}`)
      .set(auth(adminToken))
      .send({ selfEvaluationWeight: 30, managerEvaluationWeight: 70 })
      .expect(200);

    // Activate asserts weights (create/PATCH already reject invalid sums;
    // activate a valid 30/70 cycle).
    await addCompetencies(draftId, [
      {
        competencyId: competencyBaseId,
        scaleId: scale15Id,
        weight: null,
        required: true,
      },
    ]);
    await activateCycle(draftId).expect(201);

    const activated = await request(app.getHttpServer())
      .get(`/performance/cycles/${draftId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(activated.body).toMatchObject({
      status: 'ACTIVE',
      selfEvaluationWeight: '30.00',
      managerEvaluationWeight: '70.00',
    });
  });

  it('calculates normal 30/70 → overall 78.13 and marks COMPLETED', async () => {
    const cycleId = await createActiveCycle(
      `Calc normal ${suffix}`,
      [
        {
          competencyId: competencyBaseId,
          scaleId: scale15Id,
          weight: null,
          required: true,
        },
      ],
      { self: 30, manager: 70 },
    );
    const assigned = await assignParticipant(cycleId, employeeAId);
    const self = assigned.evaluations.find((e) => e.type === 'SELF')!;
    const manager = assigned.evaluations.find((e) => e.type === 'MANAGER')!;
    expect(manager).toBeTruthy();

    await submitAllLevels(self, collabToken, 4);
    await submitAllLevels(manager, managerToken, 3);
    await setEvalScore(self.id, 82.5);
    await setEvalScore(manager.id, 76.25);

    const calc = await calculateResult(cycleId, assigned.id, adminToken).expect(
      201,
    );

    expect(calc.body).toMatchObject({
      overallScore: '78.13',
      selfScore: '82.50',
      managerScore: '76.25',
      status: 'CALCULATED',
      configuredSelfWeight: '30.00',
      configuredManagerWeight: '70.00',
      effectiveSelfWeight: '30.00',
      effectiveManagerWeight: '70.00',
    });

    const participant =
      await prisma.performanceCycleParticipant.findUniqueOrThrow({
        where: { id: assigned.id },
      });
    expect(participant.status).toBe('COMPLETED');

    const audits = await prisma.auditLog.findMany({
      where: {
        companyId: companyAId,
        action: PERFORMANCE_AUDIT.PERFORMANCE_RESULT_CALCULATED,
        entityId: (calc.body as { id: string }).id,
      },
    });
    expect(audits.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects calculate when MANAGER evaluation is incomplete', async () => {
    const cycleId = await createActiveCycle(
      `Incomplete mgr ${suffix}`,
      [
        {
          competencyId: await createCompetency(
            `IncMgr ${suffix}`,
            `IM-${suffix.slice(0, 6)}`,
          ),
          scaleId: scale15Id,
          weight: null,
        },
      ],
      { self: 30, manager: 70 },
    );
    const assigned = await assignParticipant(cycleId, employeeAId);
    const self = assigned.evaluations.find((e) => e.type === 'SELF')!;
    const manager = assigned.evaluations.find((e) => e.type === 'MANAGER')!;

    await submitAllLevels(self, collabToken, 5);
    // MANAGER left PENDING/IN_PROGRESS
    expect(manager).toBeTruthy();

    await calculateResult(cycleId, assigned.id, adminToken).expect(400);
  });

  it('SELF-only re-normalizes to effective 100 → overall 82.50', async () => {
    const cycleId = await createActiveCycle(
      `Self only ${suffix}`,
      [
        {
          competencyId: await createCompetency(
            `SoloComp ${suffix}`,
            `SO-${suffix.slice(0, 6)}`,
          ),
          scaleId: scale15Id,
          weight: null,
        },
      ],
      { self: 30, manager: 70 },
    );
    const assigned = await assignParticipant(cycleId, employeeNoMgrId);
    const self = assigned.evaluations.find((e) => e.type === 'SELF')!;
    expect(assigned.evaluations.find((e) => e.type === 'MANAGER')).toBeFalsy();

    await submitAllLevels(self, leaderToken, 4);
    await setEvalScore(self.id, 82.5);

    const calc = await calculateResult(
      cycleId,
      assigned.id,
      perfManagerToken,
    ).expect(201);

    expect(calc.body).toMatchObject({
      overallScore: '82.50',
      selfScore: '82.50',
      managerScore: null,
      effectiveSelfWeight: '100.00',
      effectiveManagerWeight: '0.00',
      status: 'CALCULATED',
    });
  });

  it('second calculate returns 409', async () => {
    const cycleId = await createActiveCycle(
      `Second calc ${suffix}`,
      [
        {
          competencyId: await createCompetency(
            `SecCalc ${suffix}`,
            `SC-${suffix.slice(0, 6)}`,
          ),
          scaleId: scale15Id,
          weight: null,
        },
      ],
      { self: 30, manager: 70 },
    );
    const assigned = await assignParticipant(cycleId, employeeNoMgrId);
    const self = assigned.evaluations.find((e) => e.type === 'SELF')!;
    await submitAllLevels(self, leaderToken, 5);
    await setEvalScore(self.id, 90);

    await calculateResult(cycleId, assigned.id, adminToken).expect(201);
    await calculateResult(cycleId, assigned.id, adminToken).expect(409);
  });

  it('release + mine privacy (no managerScore for employee)', async () => {
    const cycleId = await createActiveCycle(
      `Release mine ${suffix}`,
      [
        {
          competencyId: await createCompetency(
            `RelMine ${suffix}`,
            `RM-${suffix.slice(0, 6)}`,
          ),
          scaleId: scale15Id,
          weight: null,
        },
      ],
      { self: 30, manager: 70 },
    );
    const assigned = await assignParticipant(cycleId, employeeAId);
    const self = assigned.evaluations.find((e) => e.type === 'SELF')!;
    const manager = assigned.evaluations.find((e) => e.type === 'MANAGER')!;

    await submitAllLevels(self, collabToken, 4);
    await submitAllLevels(manager, managerToken, 3);
    await setEvalScore(self.id, 82.5);
    await setEvalScore(manager.id, 76.25);

    const calc = await calculateResult(cycleId, assigned.id, adminToken).expect(
      201,
    );
    const resultId = (calc.body as { id: string }).id;

    const mineBefore = await request(app.getHttpServer())
      .get('/performance/results/mine')
      .set(auth(collabToken))
      .expect(200);
    expect(
      (mineBefore.body as { items: { id: string }[] }).items.some(
        (r) => r.id === resultId,
      ),
    ).toBe(false);

    const released = await releaseResult(
      cycleId,
      assigned.id,
      adminToken,
    ).expect(201);
    expect(released.body).toMatchObject({
      id: resultId,
      status: 'RELEASED',
    });

    const releaseAudits = await prisma.auditLog.findMany({
      where: {
        companyId: companyAId,
        action: PERFORMANCE_AUDIT.PERFORMANCE_RESULT_RELEASED,
        entityId: resultId,
      },
    });
    expect(releaseAudits.length).toBeGreaterThanOrEqual(1);

    const mineAfter = await request(app.getHttpServer())
      .get('/performance/results/mine')
      .set(auth(collabToken))
      .expect(200);
    expect(
      (
        mineAfter.body as { items: { id: string; status: string }[] }
      ).items.some((r) => r.id === resultId && r.status === 'RELEASED'),
    ).toBe(true);

    const detail = await request(app.getHttpServer())
      .get(`/performance/results/${resultId}`)
      .set(auth(collabToken))
      .expect(200);

    expect(detail.body).toMatchObject({
      overallScore: '78.13',
      selfScore: '82.50',
      managerIncluded: true,
      status: 'RELEASED',
    });
    expect(detail.body).not.toHaveProperty('managerScore');

    // MANAGER evaluation privacy remains after release
    await request(app.getHttpServer())
      .get(`/performance/evaluations/${manager.id}`)
      .set(auth(collabToken))
      .expect(403);
  });

  it('leader and collaborator cannot calculate', async () => {
    const cycleId = await createActiveCycle(
      `No calc rbac ${suffix}`,
      [
        {
          competencyId: await createCompetency(
            `NoCalc ${suffix}`,
            `NC-${suffix.slice(0, 6)}`,
          ),
          scaleId: scale15Id,
          weight: null,
        },
      ],
      { self: 30, manager: 70 },
    );
    const assigned = await assignParticipant(cycleId, employeeNoMgrId);
    const self = assigned.evaluations.find((e) => e.type === 'SELF')!;
    await submitAllLevels(self, leaderToken, 4);

    await calculateResult(cycleId, assigned.id, leaderToken).expect(403);
    await calculateResult(cycleId, assigned.id, collabToken).expect(403);
  });

  it('blocks cycle close while ACTIVE participants; allows after COMPLETED or EXCLUDED', async () => {
    const closeCompId = await createCompetency(
      `CloseComp ${suffix}`,
      `CC-${suffix.slice(0, 6)}`,
    );
    const cycleId = await createActiveCycle(
      `Close cycle ${suffix}`,
      [
        {
          competencyId: closeCompId,
          scaleId: scale15Id,
          weight: null,
        },
      ],
      { self: 30, manager: 70 },
    );
    const assigned = await assignParticipant(cycleId, employeeNoMgrId);
    const self = assigned.evaluations.find((e) => e.type === 'SELF')!;
    await submitAllLevels(self, leaderToken, 5);
    await setEvalScore(self.id, 88);

    await request(app.getHttpServer())
      .post(`/performance/cycles/${cycleId}/close`)
      .set(auth(adminToken))
      .expect(400);

    await calculateResult(cycleId, assigned.id, adminToken).expect(201);

    await request(app.getHttpServer())
      .post(`/performance/cycles/${cycleId}/close`)
      .set(auth(adminToken))
      .expect(201);

    // Exclude path: ACTIVE participant blocked, exclude then close
    const exclCycleId = await createActiveCycle(
      `Close excl ${suffix}`,
      [
        {
          competencyId: await createCompetency(
            `CloseEx ${suffix}`,
            `CE-${suffix.slice(0, 6)}`,
          ),
          scaleId: scale15Id,
          weight: null,
        },
      ],
      { self: 50, manager: 50 },
    );
    const exclAssigned = await assignParticipant(exclCycleId, employeeAId);

    await request(app.getHttpServer())
      .post(`/performance/cycles/${exclCycleId}/close`)
      .set(auth(adminToken))
      .expect(400);

    await request(app.getHttpServer())
      .post(
        `/performance/cycles/${exclCycleId}/participants/${exclAssigned.id}/exclude`,
      )
      .set(auth(adminToken))
      .expect(201);

    await request(app.getHttpServer())
      .post(`/performance/cycles/${exclCycleId}/close`)
      .set(auth(adminToken))
      .expect(201);
  });

  it('concurrent calculate yields one result (201 + 409)', async () => {
    const cycleId = await createActiveCycle(
      `Concurrent calc ${suffix}`,
      [
        {
          competencyId: await createCompetency(
            `RaceCalc ${suffix}`,
            `RC-${suffix.slice(0, 6)}`,
          ),
          scaleId: scale15Id,
          weight: null,
        },
      ],
      { self: 30, manager: 70 },
    );
    const assigned = await assignParticipant(cycleId, employeeNoMgrId);
    const self = assigned.evaluations.find((e) => e.type === 'SELF')!;
    await submitAllLevels(self, leaderToken, 4);
    await setEvalScore(self.id, 75);

    const [a, b] = await Promise.all([
      calculateResult(cycleId, assigned.id, adminToken),
      calculateResult(cycleId, assigned.id, perfManagerToken),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);

    const results = await prisma.performanceResult.findMany({
      where: { participantId: assigned.id },
    });
    expect(results).toHaveLength(1);
  });

  it('recruiter is denied tenant results list', async () => {
    await request(app.getHttpServer())
      .get('/performance/results')
      .set(auth(recruiterToken))
      .expect(403);

    // Other-company admin can list own tenant (empty) but not company A data.
    const otherTenant = await request(app.getHttpServer())
      .get('/performance/results')
      .set(auth(adminBToken, companyBId))
      .expect(200);
    expect((otherTenant.body as { items: unknown[] }).items).toEqual([]);
  });
});
