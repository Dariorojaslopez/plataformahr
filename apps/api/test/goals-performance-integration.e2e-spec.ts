/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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

type SnapshotCompetency = {
  id: string;
  name: string;
  levels: Array<{ id: string; value: number; label: string; order: number }>;
};

type AssignedParticipant = {
  id: string;
  evaluations: Array<{
    id: string;
    type: string;
    competencies: SnapshotCompetency[];
  }>;
};

type AnalyticsBody = {
  results: {
    averageScore: number | null;
    calculatedResults: number;
  };
};

describe('Goals ↔ Performance integration (09D)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let hasher: PasswordHashingService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const password = `GP09D-${suffix}!`;

  let companyAId = '';
  let companyBId = '';
  let areaAId = '';
  let areaBId = '';
  let positionAId = '';
  let adminToken = '';
  let adminBToken = '';
  let pmToken = '';
  let leaderToken = '';
  let collabToken = '';
  let nomgrToken = '';
  let recruiterToken = '';
  let employeeAId = '';
  let employeeNoMgrId = '';
  let leaderEmployeeId = '';
  let goalCycleBId = '';
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

  const createAndActivateGoalCycle = async (
    name: string,
    token = adminToken,
    companyId = companyAId,
  ) => {
    const res = await request(app.getHttpServer())
      .post('/goals/cycles')
      .set(auth(token, companyId))
      .send({
        name,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      })
      .expect(201);
    const id = (res.body as { id: string }).id;
    await request(app.getHttpServer())
      .post(`/goals/cycles/${id}/activate`)
      .set(auth(token, companyId))
      .expect(201);
    return id;
  };

  const activateGoal = async (goalId: string) => {
    await request(app.getHttpServer())
      .post(`/goals/${goalId}/activate`)
      .set(auth(adminToken))
      .expect(201);
  };

  type CompleteGoalOpts = {
    cycleId: string;
    title: string;
    type: 'INDIVIDUAL' | 'AREA' | 'COMPANY';
    employeeId?: string;
    areaId?: string;
    weight?: number | null;
    numericValue?: number;
    useBoolean?: boolean;
    requesterToken?: string;
    approverToken?: string;
  };

  const completeGoal = async (opts: CompleteGoalOpts) => {
    const body: Record<string, unknown> = {
      cycleId: opts.cycleId,
      title: opts.title,
      type: opts.type,
    };
    if (opts.type === 'AREA') body.areaId = opts.areaId;
    if (opts.weight != null) body.weight = opts.weight;

    const goalRes = await request(app.getHttpServer())
      .post('/goals')
      .set(auth(adminToken))
      .send(body)
      .expect(201);
    const goalId = (goalRes.body as { id: string }).id;

    if (opts.type === 'INDIVIDUAL' && opts.employeeId) {
      await request(app.getHttpServer())
        .post(`/goals/${goalId}/assignments`)
        .set(auth(adminToken))
        .send({ employeeId: opts.employeeId })
        .expect(201);
    } else if (opts.type === 'AREA' && opts.employeeId) {
      await request(app.getHttpServer())
        .post(`/goals/${goalId}/assignments`)
        .set(auth(adminToken))
        .send({ employeeId: opts.employeeId })
        .expect(201);
    }

    let krId: string;
    if (opts.useBoolean) {
      const kr = await request(app.getHttpServer())
        .post(`/goals/${goalId}/key-results`)
        .set(auth(adminToken))
        .send({
          title: 'Done',
          metricType: 'BOOLEAN',
          targetBoolean: true,
        })
        .expect(201);
      krId = (kr.body as { id: string }).id;
    } else {
      const kr = await request(app.getHttpServer())
        .post(`/goals/${goalId}/key-results`)
        .set(auth(adminToken))
        .send({
          title: 'Metric',
          metricType: 'NUMBER',
          direction: 'INCREASE',
          startValue: 0,
          targetValue: 100,
        })
        .expect(201);
      krId = (kr.body as { id: string }).id;
    }

    await activateGoal(goalId);

    if (opts.useBoolean) {
      await request(app.getHttpServer())
        .post(`/goals/${goalId}/key-results/${krId}/check-ins`)
        .set(auth(opts.requesterToken ?? adminToken))
        .send({ booleanValue: true })
        .expect(201);
    } else {
      await request(app.getHttpServer())
        .post(`/goals/${goalId}/key-results/${krId}/check-ins`)
        .set(auth(opts.requesterToken ?? adminToken))
        .send({ numericValue: opts.numericValue ?? 90 })
        .expect(201);
    }

    const reqToken =
      opts.requesterToken ??
      (opts.type === 'INDIVIDUAL' ? collabToken : adminToken);
    const reqRes = await request(app.getHttpServer())
      .post(`/goals/${goalId}/completion-requests`)
      .set(auth(reqToken))
      .send({})
      .expect(201);
    const requestId = (reqRes.body as { id: string }).id;

    const approveToken =
      opts.approverToken ??
      (opts.type === 'INDIVIDUAL'
        ? leaderToken
        : opts.type === 'AREA'
          ? pmToken
          : pmToken);
    const approved = await request(app.getHttpServer())
      .post(`/goals/completion-requests/${requestId}/approve`)
      .set(auth(approveToken))
      .send({})
      .expect(201);

    return {
      goalId,
      krId,
      achievementPercentage: (
        approved.body as { achievementPercentage: string }
      ).achievementPercentage,
      goalResultId: (
        await prisma.goalResult.findFirstOrThrow({ where: { goalId } })
      ).id,
    };
  };

  const createDraftPerfCycle = (
    name: string,
    opts?: {
      goalCycleId?: string | null;
      competencyResultWeight?: number;
      goalsResultWeight?: number;
      self?: number;
      manager?: number;
    },
  ) =>
    request(app.getHttpServer())
      .post('/performance/cycles')
      .set(auth(adminToken))
      .send({
        name,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        selfEvaluationWeight: opts?.self ?? 30,
        managerEvaluationWeight: opts?.manager ?? 70,
        ...(opts?.goalCycleId !== undefined
          ? { goalCycleId: opts.goalCycleId }
          : {}),
        ...(opts?.competencyResultWeight != null
          ? { competencyResultWeight: opts.competencyResultWeight }
          : {}),
        ...(opts?.goalsResultWeight != null
          ? { goalsResultWeight: opts.goalsResultWeight }
          : {}),
      });

  const addCompetencies = async (
    cycleId: string,
    competencyId = competencyBaseId,
    scaleId = scale15Id,
  ) => {
    await request(app.getHttpServer())
      .post(`/performance/cycles/${cycleId}/competencies`)
      .set(auth(adminToken))
      .send({
        competencyId,
        scaleId,
        weight: null,
        order: 0,
        required: true,
      })
      .expect(201);
  };

  const activatePerfCycle = (cycleId: string) =>
    request(app.getHttpServer())
      .post(`/performance/cycles/${cycleId}/activate`)
      .set(auth(adminToken));

  const createActivePerfCycle = async (
    name: string,
    opts?: {
      goalCycleId?: string | null;
      competencyResultWeight?: number;
      goalsResultWeight?: number;
    },
  ) => {
    const draft = await createDraftPerfCycle(name, opts).expect(201);
    const cycleId = (draft.body as { id: string }).id;
    await addCompetencies(cycleId);
    await activatePerfCycle(cycleId).expect(201);
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

  const levelByValue = (comp: SnapshotCompetency, value: number) => {
    const level = comp.levels.find((l) => l.value === value);
    if (!level) throw new Error(`Level ${value} not found`);
    return level;
  };

  const submitSelfEval = async (
    evaluation: AssignedParticipant['evaluations'][number],
    token: string,
    ratingValue = 4,
  ) => {
    for (const comp of evaluation.competencies) {
      await request(app.getHttpServer())
        .put(
          `/performance/evaluations/${evaluation.id}/competencies/${comp.id}/response`,
        )
        .set(auth(token))
        .send({ scaleLevelId: levelByValue(comp, ratingValue).id })
        .expect(200);
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

  const prepareSelfOnlyParticipant = async (
    cycleId: string,
    employeeId: string,
    token: string,
    competencyScore: number,
  ) => {
    const assigned = await assignParticipant(cycleId, employeeId);
    const self = assigned.evaluations.find((e) => e.type === 'SELF')!;
    await submitSelfEval(self, token, 4);
    await setEvalScore(self.id, competencyScore);
    return assigned;
  };

  const prepareParticipant = async (
    cycleId: string,
    employeeId: string,
    selfToken: string,
    competencyScore: number,
    managerScore = competencyScore,
  ) => {
    const assigned = await assignParticipant(cycleId, employeeId);
    const self = assigned.evaluations.find((e) => e.type === 'SELF')!;
    const manager = assigned.evaluations.find((e) => e.type === 'MANAGER');
    await submitSelfEval(self, selfToken, 4);
    await setEvalScore(self.id, competencyScore);
    if (manager) {
      await submitSelfEval(manager, leaderToken, 3);
      await setEvalScore(manager.id, managerScore);
    }
    return assigned;
  };

  const calculateResult = (
    cycleId: string,
    participantId: string,
    token = adminToken,
  ) =>
    request(app.getHttpServer())
      .post(
        `/performance/cycles/${cycleId}/participants/${participantId}/result/calculate`,
      )
      .set(auth(token));

  const releaseResult = (
    cycleId: string,
    participantId: string,
    token = adminToken,
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
        name: `GP09D A ${suffix}`,
        slug: `gp09d-a-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    const companyB = await prisma.company.create({
      data: {
        name: `GP09D B ${suffix}`,
        slug: `gp09d-b-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    companyAId = companyA.id;
    companyBId = companyB.id;

    const areaA = await prisma.area.create({
      data: { companyId: companyAId, name: `GP Area A ${suffix}` },
    });
    const areaB = await prisma.area.create({
      data: { companyId: companyAId, name: `GP Area B ${suffix}` },
    });
    areaAId = areaA.id;
    areaBId = areaB.id;

    const jl = await prisma.jobLevel.create({
      data: {
        companyId: companyAId,
        name: `GP JL ${suffix}`,
        rank: 7000 + Math.floor(Math.random() * 400),
      },
    });
    const position = await prisma.position.create({
      data: {
        companyId: companyAId,
        areaId: areaAId,
        jobLevelId: jl.id,
        name: `GP Pos ${suffix}`,
        headcount: 30,
      },
    });
    positionAId = position.id;

    const perfPermissions = [
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

    const goalsPermissions = [
      'goals.cycle.read',
      'goals.cycle.manage',
      'goals.goal.read',
      'goals.goal.manage',
      'goals.goal.assign',
      'goals.progress.update',
      'goals.completion.request',
      'goals.completion.review',
    ] as const;

    const allPermissions = [...perfPermissions, ...goalsPermissions];
    const permissionIds = new Map<string, string>();
    for (const code of allPermissions) {
      const saved = await prisma.permission.upsert({
        where: { code },
        create: { code, name: code, description: 'x' },
        update: {},
      });
      permissionIds.set(code, saved.id);
    }

    const byRole: Record<string, string[]> = {
      CLIENT_ADMIN: [...allPermissions],
      PERFORMANCE_MANAGER: [...allPermissions],
      LEADER: [
        'performance.cycle.read',
        'performance.competency.read',
        'performance.scale.read',
        'performance.evaluation.read',
        'performance.evaluation.respond',
        'goals.cycle.read',
        'goals.goal.read',
        'goals.completion.review',
      ],
      COLLABORATOR: [
        'performance.cycle.read',
        'performance.competency.read',
        'performance.scale.read',
        'performance.evaluation.read',
        'performance.evaluation.respond',
        'goals.cycle.read',
        'goals.goal.read',
        'goals.progress.update',
        'goals.completion.request',
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
          firstName: 'GP',
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
      `gp-admin-${suffix}@example.com`,
      'CLIENT_ADMIN',
      companyAId,
    );
    await createUser(
      `gp-pm-${suffix}@example.com`,
      'PERFORMANCE_MANAGER',
      companyAId,
    );
    const leaderUser = await createUser(
      `gp-leader-${suffix}@example.com`,
      'LEADER',
      companyAId,
    );
    const collabUser = await createUser(
      `gp-collab-${suffix}@example.com`,
      'COLLABORATOR',
      companyAId,
    );
    const noMgrUser = await createUser(
      `gp-nomgr-${suffix}@example.com`,
      'COLLABORATOR',
      companyAId,
    );
    await createUser(
      `gp-admin-b-${suffix}@example.com`,
      'CLIENT_ADMIN',
      companyBId,
    );
    await createUser(
      `gp-recruiter-${suffix}@example.com`,
      'RECRUITER',
      companyAId,
    );

    const empLeader = await prisma.employee.create({
      data: {
        companyId: companyAId,
        firstName: 'Leader',
        lastName: 'GP',
        email: `gp-leader-emp-${suffix}@example.com`,
        areaId: areaAId,
        positionId: positionAId,
        status: EmployeeStatus.ACTIVE,
        userId: leaderUser.id,
      },
    });
    const empA = await prisma.employee.create({
      data: {
        companyId: companyAId,
        firstName: 'Ana',
        lastName: 'GP',
        email: `gp-ana-${suffix}@example.com`,
        areaId: areaAId,
        positionId: positionAId,
        status: EmployeeStatus.ACTIVE,
        userId: collabUser.id,
      },
    });
    const empNoMgr = await prisma.employee.create({
      data: {
        companyId: companyAId,
        firstName: 'Solo',
        lastName: 'GP',
        email: `gp-solo-${suffix}@example.com`,
        areaId: areaAId,
        positionId: positionAId,
        status: EmployeeStatus.ACTIVE,
        userId: noMgrUser.id,
      },
    });

    employeeAId = empA.id;
    employeeNoMgrId = empNoMgr.id;
    leaderEmployeeId = empLeader.id;

    await prisma.employeeReportingLine.create({
      data: {
        companyId: companyAId,
        employeeId: employeeAId,
        managerEmployeeId: leaderEmployeeId,
        type: ReportingLineType.DIRECT,
      },
    });

    adminToken = await login(`gp-admin-${suffix}@example.com`);
    pmToken = await login(`gp-pm-${suffix}@example.com`);
    leaderToken = await login(`gp-leader-${suffix}@example.com`);
    collabToken = await login(`gp-collab-${suffix}@example.com`);
    nomgrToken = await login(`gp-nomgr-${suffix}@example.com`);
    adminBToken = await login(`gp-admin-b-${suffix}@example.com`);
    recruiterToken = await login(`gp-recruiter-${suffix}@example.com`);

    scale15Id = await createScale(
      `GP Scale ${suffix}`,
      [1, 2, 3, 4, 5].map((v) => ({
        value: v,
        label: `N${v}`,
        order: v,
      })),
    );
    competencyBaseId = await createCompetency(
      `GP Comp ${suffix}`,
      `GPC-${suffix.slice(0, 6)}`,
    );

    goalCycleBId = await createAndActivateGoalCycle(
      `GP Goal B ${suffix}`,
      adminBToken,
      companyBId,
    );
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('competency-only cycle preserves 08D; cross-tenant goalCycleId → 404', async () => {
    const cycleId = await createActivePerfCycle(`GP 08D only ${suffix}`);
    const assigned = await prepareSelfOnlyParticipant(
      cycleId,
      employeeNoMgrId,
      nomgrToken,
      82.5,
    );

    const calc = await calculateResult(cycleId, assigned.id).expect(201);
    expect(calc.body).toMatchObject({
      overallScore: '82.50',
      competencyScore: '82.50',
      goalsAchievement: null,
      composition: 'COMPETENCY_ONLY',
      status: 'CALCULATED',
    });

    await createDraftPerfCycle(`GP cross tenant ${suffix}`, {
      goalCycleId: goalCycleBId,
      competencyResultWeight: 70,
      goalsResultWeight: 30,
    }).expect(404);

    const draftPatch = await createDraftPerfCycle(`GP patch tenant ${suffix}`);
    const draftPatchId = (draftPatch.body as { id: string }).id;
    await request(app.getHttpServer())
      .patch(`/performance/cycles/${draftPatchId}`)
      .set(auth(adminToken))
      .send({
        goalCycleId: goalCycleBId,
        competencyResultWeight: 70,
        goalsResultWeight: 30,
      })
      .expect(404);
  });

  it('integrated 70/30, missing GoalResult, and zero applicable results', async () => {
    const goalCycleId = await createAndActivateGoalCycle(`GP Int ${suffix}`);
    await completeGoal({
      cycleId: goalCycleId,
      title: 'Indiv 90',
      type: 'INDIVIDUAL',
      employeeId: employeeNoMgrId,
      numericValue: 90,
      requesterToken: nomgrToken,
      approverToken: pmToken,
    });

    const cycleId = await createActivePerfCycle(`GP 70/30 ${suffix}`, {
      goalCycleId,
      competencyResultWeight: 70,
      goalsResultWeight: 30,
    });
    const assigned = await prepareSelfOnlyParticipant(
      cycleId,
      employeeNoMgrId,
      nomgrToken,
      80,
    );

    const calc = await calculateResult(cycleId, assigned.id).expect(201);
    expect(calc.body).toMatchObject({
      competencyScore: '80.00',
      goalsAchievement: '90.00',
      overallScore: '83.00',
      composition: 'COMPETENCY_AND_GOALS',
      configuredCompetencyResultWeight: '70.00',
      configuredGoalsResultWeight: '30.00',
    });

    const missingCycleId = await createActivePerfCycle(
      `GP missing GR ${suffix}`,
      {
        goalCycleId,
        competencyResultWeight: 70,
        goalsResultWeight: 30,
      },
    );
    const goalRes = await request(app.getHttpServer())
      .post('/goals')
      .set(auth(adminToken))
      .send({
        cycleId: goalCycleId,
        title: 'Incomplete',
        type: 'INDIVIDUAL',
      })
      .expect(201);
    const incompleteGoalId = (goalRes.body as { id: string }).id;
    await request(app.getHttpServer())
      .post(`/goals/${incompleteGoalId}/assignments`)
      .set(auth(adminToken))
      .send({ employeeId: employeeNoMgrId })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/goals/${incompleteGoalId}/key-results`)
      .set(auth(adminToken))
      .send({
        title: 'KR',
        metricType: 'NUMBER',
        direction: 'INCREASE',
        startValue: 0,
        targetValue: 100,
      })
      .expect(201);
    await activateGoal(incompleteGoalId);

    const missingAssigned = await prepareSelfOnlyParticipant(
      missingCycleId,
      employeeNoMgrId,
      nomgrToken,
      75,
    );
    const missingRes = await calculateResult(
      missingCycleId,
      missingAssigned.id,
    );
    expect(missingRes.status).toBe(400);
    expect(String(missingRes.body?.message ?? missingRes.text)).toMatch(
      /GoalResult|objetivos aplicables sin resultado/i,
    );

    const emptyGoalCycleId = await createAndActivateGoalCycle(
      `GP empty ${suffix}`,
    );
    const emptyPerfId = await createActivePerfCycle(`GP no results ${suffix}`, {
      goalCycleId: emptyGoalCycleId,
      competencyResultWeight: 70,
      goalsResultWeight: 30,
    });
    const emptyAssigned = await prepareSelfOnlyParticipant(
      emptyPerfId,
      employeeNoMgrId,
      nomgrToken,
      70,
    );
    const emptyRes = await calculateResult(emptyPerfId, emptyAssigned.id);
    expect(emptyRes.status).toBe(400);
    expect(String(emptyRes.body?.message ?? emptyRes.text)).toMatch(
      /No existen resultados de objetivos aplicables/i,
    );
  });

  it('goal types INDIVIDUAL, AREA, COMPANY; unweighted and weighted aggregation', async () => {
    const goalCycleId = await createAndActivateGoalCycle(`GP types ${suffix}`);

    await completeGoal({
      cycleId: goalCycleId,
      title: 'Individual',
      type: 'INDIVIDUAL',
      employeeId: employeeAId,
      numericValue: 90,
    });
    await completeGoal({
      cycleId: goalCycleId,
      title: 'Area',
      type: 'AREA',
      areaId: areaAId,
      employeeId: employeeAId,
      numericValue: 80,
    });
    await completeGoal({
      cycleId: goalCycleId,
      title: 'Company',
      type: 'COMPANY',
      numericValue: 70,
    });

    const unweightedCycleId = await createActivePerfCycle(
      `GP unweighted ${suffix}`,
      {
        goalCycleId,
        competencyResultWeight: 100,
        goalsResultWeight: 0,
      },
    );
    const unweightedAssigned = await prepareParticipant(
      unweightedCycleId,
      employeeAId,
      collabToken,
      80,
    );
    const unweightedCalc = await calculateResult(
      unweightedCycleId,
      unweightedAssigned.id,
    ).expect(201);
    expect(unweightedCalc.body).toMatchObject({
      overallScore: '80.00',
      goalsAchievement: null,
      composition: 'COMPETENCY_AND_GOALS',
    });

    const weightedGoalCycleId = await createAndActivateGoalCycle(
      `GP weighted ${suffix}`,
    );
    await completeGoal({
      cycleId: weightedGoalCycleId,
      title: 'W1',
      type: 'INDIVIDUAL',
      employeeId: employeeAId,
      weight: 60,
      numericValue: 100,
    });
    await completeGoal({
      cycleId: weightedGoalCycleId,
      title: 'W2',
      type: 'INDIVIDUAL',
      employeeId: employeeAId,
      weight: 40,
      numericValue: 50,
    });

    const weightedCycleId = await createActivePerfCycle(
      `GP weighted calc ${suffix}`,
      {
        goalCycleId: weightedGoalCycleId,
        competencyResultWeight: 50,
        goalsResultWeight: 50,
      },
    );
    const weightedAssigned = await prepareParticipant(
      weightedCycleId,
      employeeAId,
      collabToken,
      80,
    );
    const weightedCalc = await calculateResult(
      weightedCycleId,
      weightedAssigned.id,
    ).expect(201);
    expect(weightedCalc.body).toMatchObject({
      goalsAchievement: '80.00',
      overallScore: '80.00',
    });
    expect(weightedCalc.body.goals).toHaveLength(2);

    const equalGoalCycleId = await createAndActivateGoalCycle(
      `GP equal ${suffix}`,
    );
    await completeGoal({
      cycleId: equalGoalCycleId,
      title: 'E1',
      type: 'INDIVIDUAL',
      employeeId: employeeAId,
      numericValue: 100,
    });
    await completeGoal({
      cycleId: equalGoalCycleId,
      title: 'E2',
      type: 'INDIVIDUAL',
      employeeId: employeeAId,
      numericValue: 60,
    });

    const equalCycleId = await createActivePerfCycle(
      `GP equal calc ${suffix}`,
      {
        goalCycleId: equalGoalCycleId,
        competencyResultWeight: 0,
        goalsResultWeight: 100,
      },
    );
    const equalAssigned = await prepareParticipant(
      equalCycleId,
      employeeAId,
      collabToken,
      50,
    );
    const equalCalc = await calculateResult(
      equalCycleId,
      equalAssigned.id,
    ).expect(201);
    expect(equalCalc.body).toMatchObject({
      competencyScore: '50.00',
      goalsAchievement: '80.00',
      overallScore: '80.00',
    });
  });

  it('area change after GoalResult; snapshots created and frozen', async () => {
    const goalCycleId = await createAndActivateGoalCycle(
      `GP area snap ${suffix}`,
    );
    const areaGoal = await completeGoal({
      cycleId: goalCycleId,
      title: 'Area snap',
      type: 'AREA',
      areaId: areaAId,
      employeeId: employeeAId,
      useBoolean: true,
      requesterToken: collabToken,
    });
    expect(areaGoal.achievementPercentage).toBe('100');

    await prisma.employee.update({
      where: { id: employeeAId },
      data: { areaId: areaBId },
    });

    const cycleId = await createActivePerfCycle(`GP snap ${suffix}`, {
      goalCycleId,
      competencyResultWeight: 60,
      goalsResultWeight: 40,
    });
    const assigned = await prepareParticipant(
      cycleId,
      employeeAId,
      collabToken,
      75,
    );
    const calc = await calculateResult(cycleId, assigned.id).expect(201);
    const resultId = (calc.body as { id: string }).id;

    expect(calc.body.goals).toHaveLength(1);
    expect(calc.body.goals[0]).toMatchObject({
      goalTitle: 'Area snap',
      goalType: 'AREA',
      achievementPercentage: '100.00',
    });

    const snapshots = await prisma.performanceResultGoal.findMany({
      where: { performanceResultId: resultId },
    });
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]?.sourceGoalId).toBe(areaGoal.goalId);

    await prisma.goal.update({
      where: { id: areaGoal.goalId },
      data: { title: 'Mutated title' },
    });
    await prisma.goalResult.update({
      where: { id: areaGoal.goalResultId },
      data: { achievementPercentage: 10 },
    });

    const detail = await request(app.getHttpServer())
      .get(`/performance/results/${resultId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(detail.body).toMatchObject({
      goalsAchievement: '100.00',
      overallScore: '85.00',
    });
    expect(detail.body.goals[0].goalTitle).toBe('Area snap');
    expect(detail.body.goals[0].achievementPercentage).toBe('100.00');
  });

  it('release, employee RELEASED visibility, and manager privacy', async () => {
    const goalCycleId = await createAndActivateGoalCycle(
      `GP release ${suffix}`,
    );
    await completeGoal({
      cycleId: goalCycleId,
      title: 'Rel goal',
      type: 'INDIVIDUAL',
      employeeId: employeeAId,
      numericValue: 90,
    });

    const cycleId = await createActivePerfCycle(`GP rel perf ${suffix}`, {
      goalCycleId,
      competencyResultWeight: 70,
      goalsResultWeight: 30,
    });
    const assigned = await assignParticipant(cycleId, employeeAId);
    const self = assigned.evaluations.find((e) => e.type === 'SELF')!;
    const manager = assigned.evaluations.find((e) => e.type === 'MANAGER')!;

    for (const comp of self.competencies) {
      await request(app.getHttpServer())
        .put(
          `/performance/evaluations/${self.id}/competencies/${comp.id}/response`,
        )
        .set(auth(collabToken))
        .send({ scaleLevelId: levelByValue(comp, 4).id })
        .expect(200);
    }
    await request(app.getHttpServer())
      .post(`/performance/evaluations/${self.id}/submit`)
      .set(auth(collabToken))
      .expect(201);
    for (const comp of manager.competencies) {
      await request(app.getHttpServer())
        .put(
          `/performance/evaluations/${manager.id}/competencies/${comp.id}/response`,
        )
        .set(auth(leaderToken))
        .send({ scaleLevelId: levelByValue(comp, 3).id })
        .expect(200);
    }
    await request(app.getHttpServer())
      .post(`/performance/evaluations/${manager.id}/submit`)
      .set(auth(leaderToken))
      .expect(201);
    await setEvalScore(self.id, 80);
    await setEvalScore(manager.id, 76);

    const calc = await calculateResult(cycleId, assigned.id).expect(201);
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

    await releaseResult(cycleId, assigned.id).expect(201);

    const mineAfter = await request(app.getHttpServer())
      .get('/performance/results/mine')
      .set(auth(collabToken))
      .expect(200);
    const releasedItem = (
      mineAfter.body as { items: { id: string; status: string }[] }
    ).items.find((r) => r.id === resultId);
    expect(releasedItem?.status).toBe('RELEASED');

    const detail = await request(app.getHttpServer())
      .get(`/performance/results/${resultId}`)
      .set(auth(collabToken))
      .expect(200);
    expect(detail.body).toMatchObject({
      status: 'RELEASED',
      overallScore: '81.04',
      competencyScore: '77.20',
      goalsAchievement: '90.00',
      composition: 'COMPETENCY_AND_GOALS',
      managerIncluded: true,
    });
    expect(detail.body).not.toHaveProperty('managerScore');
    expect(detail.body.goals).toHaveLength(1);

    await request(app.getHttpServer())
      .get(`/performance/evaluations/${manager.id}`)
      .set(auth(collabToken))
      .expect(403);
  });

  it('analytics uses overallScore; CSV includes composition columns', async () => {
    const goalCycleId = await createAndActivateGoalCycle(
      `GP analytics ${suffix}`,
    );
    await completeGoal({
      cycleId: goalCycleId,
      title: 'CSV goal',
      type: 'INDIVIDUAL',
      employeeId: employeeNoMgrId,
      numericValue: 90,
      requesterToken: nomgrToken,
      approverToken: pmToken,
    });

    const cycleId = await createActivePerfCycle(`GP csv ${suffix}`, {
      goalCycleId,
      competencyResultWeight: 70,
      goalsResultWeight: 30,
    });
    const assigned = await prepareSelfOnlyParticipant(
      cycleId,
      employeeNoMgrId,
      nomgrToken,
      80,
    );
    await calculateResult(cycleId, assigned.id).expect(201);

    const analytics = await request(app.getHttpServer())
      .get(`/performance/cycles/${cycleId}/analytics`)
      .set(auth(adminToken))
      .expect(200);
    const analyticsBody = analytics.body as AnalyticsBody;
    expect(analyticsBody.results.calculatedResults).toBe(1);
    expect(analyticsBody.results.averageScore).toBe(83);

    const exportRes = await request(app.getHttpServer())
      .get(`/performance/results/export?cycleId=${cycleId}`)
      .set(auth(adminToken))
      .expect(200);

    const csvText =
      typeof exportRes.text === 'string'
        ? exportRes.text
        : Buffer.isBuffer(exportRes.body)
          ? exportRes.body.toString('utf8')
          : String(exportRes.body);

    expect(csvText).toContain('Resultado general');
    expect(csvText).toContain('Competencias');
    expect(csvText).toContain('Objetivos');
    expect(csvText).toContain('Composición');
    expect(csvText).toContain('COMPETENCY_AND_GOALS');
    expect(csvText).toContain('83');
    expect(csvText).toContain('80');
    expect(csvText).toContain('90');
  });

  it('concurrent calculate, cross-tenant 404, recruiter RBAC', async () => {
    const goalCycleId = await createAndActivateGoalCycle(`GP race ${suffix}`);
    await completeGoal({
      cycleId: goalCycleId,
      title: 'Race goal',
      type: 'INDIVIDUAL',
      employeeId: employeeNoMgrId,
      numericValue: 85,
      requesterToken: nomgrToken,
      approverToken: pmToken,
    });

    const cycleId = await createActivePerfCycle(`GP concurrent ${suffix}`, {
      goalCycleId,
      competencyResultWeight: 70,
      goalsResultWeight: 30,
    });
    const assigned = await prepareSelfOnlyParticipant(
      cycleId,
      employeeNoMgrId,
      nomgrToken,
      75,
    );

    const [a, b] = await Promise.all([
      calculateResult(cycleId, assigned.id, adminToken),
      calculateResult(cycleId, assigned.id, pmToken),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);

    const results = await prisma.performanceResult.findMany({
      where: { participantId: assigned.id },
    });
    expect(results).toHaveLength(1);
    const resultId = results[0].id;

    await request(app.getHttpServer())
      .get(`/performance/results/${resultId}`)
      .set(auth(adminBToken, companyBId))
      .expect(404);

    const recruiterCycleId = await createActivePerfCycle(
      `GP recruiter ${suffix}`,
    );
    const recruiterAssigned = await prepareSelfOnlyParticipant(
      recruiterCycleId,
      employeeNoMgrId,
      nomgrToken,
      70,
    );
    await calculateResult(
      recruiterCycleId,
      recruiterAssigned.id,
      recruiterToken,
    ).expect(403);
  });
});
