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
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PasswordHashingService } from '../src/auth/password-hashing.service';
import { PERFORMANCE_AUDIT } from '../src/performance/performance.constants';

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
  required: boolean;
  weight: string | null;
  levels: Array<{ id: string; value: number; label: string; order: number }>;
  response: {
    selectedScaleLevelId: string;
    ratingValue: number;
    comment: string | null;
  } | null;
};

type EvaluationDetail = {
  id: string;
  status: string;
  startedAt: string | null;
  submittedAt: string | null;
  scorePercentage: string | null;
  type: string;
  participant: { id: string; status: string };
  canRespond: boolean;
  competencies: SnapshotCompetency[];
};

describe('Performance responses (08C)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let hasher: PasswordHashingService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const password = `RespPass-${suffix}!`;

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

  const createActiveCycle = async (
    name: string,
    assignments: Array<{
      competencyId: string;
      scaleId: string;
      weight?: number | null;
      order?: number;
      required?: boolean;
    }>,
  ) => {
    const cycle = await request(app.getHttpServer())
      .post('/performance/cycles')
      .set(auth(adminToken))
      .send({
        name,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      })
      .expect(201);
    const cycleId = (cycle.body as { id: string }).id;
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
    return res.body as {
      id: string;
      evaluations: Array<{
        id: string;
        type: string;
        competencies: SnapshotCompetency[];
      }>;
    };
  };

  const getEvaluation = async (evaluationId: string, token: string) => {
    const res = await request(app.getHttpServer())
      .get(`/performance/evaluations/${evaluationId}`)
      .set(auth(token))
      .expect(200);
    return res.body as EvaluationDetail;
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
        name: `Resp A ${suffix}`,
        slug: `resp-a-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    const companyB = await prisma.company.create({
      data: {
        name: `Resp B ${suffix}`,
        slug: `resp-b-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    companyAId = companyA.id;
    companyBId = companyB.id;

    const bu = await prisma.businessUnit.create({
      data: { companyId: companyAId, name: `Resp BU ${suffix}` },
    });
    const area = await prisma.area.create({
      data: {
        companyId: companyAId,
        businessUnitId: bu.id,
        name: `Resp Area ${suffix}`,
      },
    });
    areaAId = area.id;
    const jl = await prisma.jobLevel.create({
      data: {
        companyId: companyAId,
        name: `Resp JL ${suffix}`,
        rank: 4000 + Math.floor(Math.random() * 500),
      },
    });
    const position = await prisma.position.create({
      data: {
        companyId: companyAId,
        areaId: areaAId,
        jobLevelId: jl.id,
        name: `Resp Pos ${suffix}`,
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
          firstName: 'Resp',
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
      `resp-admin-${suffix}@example.com`,
      'CLIENT_ADMIN',
      companyAId,
    );
    await createUser(
      `resp-pm-${suffix}@example.com`,
      'PERFORMANCE_MANAGER',
      companyAId,
    );
    const leaderUser = await createUser(
      `resp-leader-${suffix}@example.com`,
      'LEADER',
      companyAId,
    );
    const collabUser = await createUser(
      `resp-collab-${suffix}@example.com`,
      'COLLABORATOR',
      companyAId,
    );
    const managerUser = await createUser(
      `resp-manager-${suffix}@example.com`,
      'LEADER',
      companyAId,
    );
    await createUser(
      `resp-admin-b-${suffix}@example.com`,
      'CLIENT_ADMIN',
      companyBId,
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
          lastName: 'Resp',
          email,
          areaId: areaAId,
          positionId: positionAId,
          status: EmployeeStatus.ACTIVE,
          ...(userId ? { userId } : {}),
        },
      });

    const empA = await createEmp(
      'Alice',
      `resp-alice-${suffix}@example.com`,
      collabUser.id,
    );
    const empB = await createEmp(
      'Bob',
      `resp-bob-${suffix}@example.com`,
      managerUser.id,
    );
    const empNoMgr = await createEmp(
      'Solo',
      `resp-solo-${suffix}@example.com`,
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

    adminToken = await login(`resp-admin-${suffix}@example.com`);
    perfManagerToken = await login(`resp-pm-${suffix}@example.com`);
    leaderToken = await login(`resp-leader-${suffix}@example.com`);
    collabToken = await login(`resp-collab-${suffix}@example.com`);
    managerToken = await login(`resp-manager-${suffix}@example.com`);
    adminBToken = await login(`resp-admin-b-${suffix}@example.com`);

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

  it('saves SELF response (status/startedAt/rating/comment), upserts, and rejects invalid/auth cases', async () => {
    const cycleId = await createActiveCycle(`Save ${suffix}`, [
      {
        competencyId: competencyBaseId,
        scaleId: scale15Id,
        weight: null,
        required: true,
      },
    ]);
    const assigned = await assignParticipant(cycleId, employeeAId);
    const self = assigned.evaluations.find((e) => e.type === 'SELF')!;
    const comp = self.competencies[0];
    const level2 = levelByValue(comp, 2);

    const saved = await putResponse(self.id, comp.id, collabToken, {
      scaleLevelId: level2.id,
      comment: '  primer borrador  ',
    }).expect(200);

    expect(saved.body).toMatchObject({
      evaluationId: self.id,
      evaluationCompetencyId: comp.id,
      selectedScaleLevelId: level2.id,
      ratingValue: 2,
      comment: 'primer borrador',
    });

    const afterFirst = await getEvaluation(self.id, collabToken);
    expect(afterFirst.status).toBe('IN_PROGRESS');
    expect(afterFirst.startedAt).toBeTruthy();
    const startedAt = afterFirst.startedAt;

    const level4 = levelByValue(comp, 4);
    await putResponse(self.id, comp.id, collabToken, {
      scaleLevelId: level4.id,
      comment: '   ',
    }).expect(200);

    const afterUpsert = await getEvaluation(self.id, collabToken);
    expect(afterUpsert.status).toBe('IN_PROGRESS');
    expect(afterUpsert.startedAt).toBe(startedAt);
    expect(afterUpsert.competencies[0].response).toMatchObject({
      selectedScaleLevelId: level4.id,
      ratingValue: 4,
      comment: null,
    });

    const responseCount = await prisma.performanceEvaluationResponse.count({
      where: { evaluationId: self.id, evaluationCompetencyId: comp.id },
    });
    expect(responseCount).toBe(1);

    await putResponse(self.id, randomUUID(), collabToken, {
      scaleLevelId: level4.id,
    }).expect(404);

    const otherCompId = await createCompetency(
      `Other ${suffix}`,
      `OTH-${suffix.slice(0, 6)}`,
    );
    const otherCycleId = await createActiveCycle(`Other cycle ${suffix}`, [
      {
        competencyId: otherCompId,
        scaleId: scale15Id,
        weight: null,
      },
    ]);
    const otherAssigned = await assignParticipant(
      otherCycleId,
      employeeNoMgrId,
    );
    const otherSelf = otherAssigned.evaluations.find((e) => e.type === 'SELF')!;
    const foreignLevel = otherSelf.competencies[0].levels[0];

    await putResponse(self.id, comp.id, collabToken, {
      scaleLevelId: foreignLevel.id,
    }).expect(400);

    await putResponse(self.id, comp.id, managerToken, {
      scaleLevelId: level4.id,
    }).expect(403);

    await putResponse(self.id, comp.id, adminToken, {
      scaleLevelId: level4.id,
    }).expect(403);

    await putResponse(self.id, comp.id, leaderToken, {
      scaleLevelId: level4.id,
    }).expect(403);
  });

  it('validates submit required/optional, scores on success, and blocks second submit/save', async () => {
    const reqCompId = await createCompetency(
      `Req ${suffix}`,
      `REQ-${suffix.slice(0, 6)}`,
    );
    const optCompId = await createCompetency(
      `Opt ${suffix}`,
      `OPT-${suffix.slice(0, 6)}`,
    );
    const cycleId = await createActiveCycle(`Submit ${suffix}`, [
      {
        competencyId: reqCompId,
        scaleId: scale15Id,
        weight: null,
        order: 0,
        required: true,
      },
      {
        competencyId: optCompId,
        scaleId: scale15Id,
        weight: null,
        order: 1,
        required: false,
      },
    ]);
    const assigned = await assignParticipant(cycleId, employeeAId);
    const self = assigned.evaluations.find((e) => e.type === 'SELF')!;
    const required = self.competencies.find((c) => c.required)!;
    const optional = self.competencies.find((c) => !c.required)!;

    const missing = await request(app.getHttpServer())
      .post(`/performance/evaluations/${self.id}/submit`)
      .set(auth(collabToken))
      .expect(400);
    expect(missing.body).toMatchObject({
      missingRequired: [{ id: required.id, name: required.name }],
    });

    await putResponse(self.id, required.id, collabToken, {
      scaleLevelId: levelByValue(required, 5).id,
    }).expect(200);

    const submitted = await request(app.getHttpServer())
      .post(`/performance/evaluations/${self.id}/submit`)
      .set(auth(collabToken))
      .expect(201);

    const body = submitted.body as EvaluationDetail;
    expect(body.status).toBe('SUBMITTED');
    expect(body.submittedAt).toBeTruthy();
    expect(body.scorePercentage).toBe('100.00');
    expect(
      body.competencies.find((c) => c.id === optional.id)!.response,
    ).toBeNull();

    await request(app.getHttpServer())
      .post(`/performance/evaluations/${self.id}/submit`)
      .set(auth(collabToken))
      .expect(409);

    await putResponse(self.id, required.id, collabToken, {
      scaleLevelId: levelByValue(required, 4).id,
    }).expect(409);

    const allOptionalCycle = await createActiveCycle(`Zero ${suffix}`, [
      {
        competencyId: await createCompetency(
          `AllOpt ${suffix}`,
          `AOPT-${suffix.slice(0, 5)}`,
        ),
        scaleId: scale15Id,
        weight: null,
        required: false,
      },
    ]);
    const zeroAssigned = await assignParticipant(
      allOptionalCycle,
      employeeNoMgrId,
    );
    const zeroSelf = zeroAssigned.evaluations.find((e) => e.type === 'SELF')!;
    await request(app.getHttpServer())
      .post(`/performance/evaluations/${zeroSelf.id}/submit`)
      .set(auth(leaderToken))
      .expect(400);

    const audits = await prisma.auditLog.findMany({
      where: {
        companyId: companyAId,
        action: {
          in: [
            PERFORMANCE_AUDIT.PERFORMANCE_EVALUATION_RESPONSE_SAVED,
            PERFORMANCE_AUDIT.PERFORMANCE_EVALUATION_SUBMITTED,
          ],
        },
        entityId: {
          in: [
            body.id,
            ...(
              await prisma.performanceEvaluationResponse.findMany({
                where: { evaluationId: self.id },
                select: { id: true },
              })
            ).map((r) => r.id),
          ],
        },
      },
    });
    expect(
      audits.some(
        (a) =>
          a.action === PERFORMANCE_AUDIT.PERFORMANCE_EVALUATION_RESPONSE_SAVED,
      ),
    ).toBe(true);
    expect(
      audits.some(
        (a) => a.action === PERFORMANCE_AUDIT.PERFORMANCE_EVALUATION_SUBMITTED,
      ),
    ).toBe(true);
  });

  it('computes unweighted, weighted (with renormalization), and mixed-scale scores', async () => {
    const unweightedComps = await Promise.all([
      createCompetency(`UW1 ${suffix}`, `UW1-${suffix.slice(0, 5)}`),
      createCompetency(`UW2 ${suffix}`, `UW2-${suffix.slice(0, 5)}`),
      createCompetency(`UW3 ${suffix}`, `UW3-${suffix.slice(0, 5)}`),
    ]);
    const uwCycle = await createActiveCycle(
      `Unweighted ${suffix}`,
      unweightedComps.map((competencyId, order) => ({
        competencyId,
        scaleId: scale15Id,
        weight: null,
        order,
        required: true,
      })),
    );
    const uwAssigned = await assignParticipant(uwCycle, employeeAId);
    const uwSelf = uwAssigned.evaluations.find((e) => e.type === 'SELF')!;
    const ratings = [4, 5, 3];
    for (let i = 0; i < ratings.length; i += 1) {
      const comp = uwSelf.competencies[i];
      await putResponse(uwSelf.id, comp.id, collabToken, {
        scaleLevelId: levelByValue(comp, ratings[i]).id,
      }).expect(200);
    }
    const uwSubmit = await request(app.getHttpServer())
      .post(`/performance/evaluations/${uwSelf.id}/submit`)
      .set(auth(collabToken))
      .expect(201);
    expect((uwSubmit.body as EvaluationDetail).scorePercentage).toBe('75.00');

    const weightedComps = await Promise.all([
      createCompetency(`W1 ${suffix}`, `W1-${suffix.slice(0, 6)}`),
      createCompetency(`W2 ${suffix}`, `W2-${suffix.slice(0, 6)}`),
      createCompetency(`W3 ${suffix}`, `W3-${suffix.slice(0, 6)}`),
    ]);
    const wCycle = await createActiveCycle(`Weighted ${suffix}`, [
      {
        competencyId: weightedComps[0],
        scaleId: scale15Id,
        weight: 50,
        order: 0,
        required: true,
      },
      {
        competencyId: weightedComps[1],
        scaleId: scale15Id,
        weight: 30,
        order: 1,
        required: true,
      },
      {
        competencyId: weightedComps[2],
        scaleId: scale15Id,
        weight: 20,
        order: 2,
        required: false,
      },
    ]);
    const wAssigned = await assignParticipant(wCycle, employeeNoMgrId);
    const wSelf = wAssigned.evaluations.find((e) => e.type === 'SELF')!;
    const wRequired = wSelf.competencies.filter((c) => c.required);
    await putResponse(wSelf.id, wRequired[0].id, leaderToken, {
      scaleLevelId: levelByValue(wRequired[0], 4).id,
    }).expect(200);
    await putResponse(wSelf.id, wRequired[1].id, leaderToken, {
      scaleLevelId: levelByValue(wRequired[1], 5).id,
    }).expect(200);
    // optional (weight 20) omitted → renormalize over 80
    const wSubmit = await request(app.getHttpServer())
      .post(`/performance/evaluations/${wSelf.id}/submit`)
      .set(auth(leaderToken))
      .expect(201);
    expect((wSubmit.body as EvaluationDetail).scorePercentage).toBe('84.38');

    const scale010Id = await createScale(
      `Escala 0-10 ${suffix}`,
      [0, 2, 4, 6, 8, 10].map((v, i) => ({
        value: v,
        label: `Z${v}`,
        order: i + 1,
      })),
    );
    const mixedComps = await Promise.all([
      createCompetency(`Mix15 ${suffix}`, `M15-${suffix.slice(0, 5)}`),
      createCompetency(`Mix010 ${suffix}`, `M10-${suffix.slice(0, 5)}`),
    ]);
    const mixCycle = await createActiveCycle(`Mixed ${suffix}`, [
      {
        competencyId: mixedComps[0],
        scaleId: scale15Id,
        weight: null,
        order: 0,
      },
      {
        competencyId: mixedComps[1],
        scaleId: scale010Id,
        weight: null,
        order: 1,
      },
    ]);
    const mixAssigned = await assignParticipant(mixCycle, employeeAId);
    const mixSelf = mixAssigned.evaluations.find((e) => e.type === 'SELF')!;
    const mix15 = mixSelf.competencies.find(
      (c) =>
        c.levels.some((l) => l.value === 5) &&
        c.levels.some((l) => l.value === 1),
    )!;
    const mix010 = mixSelf.competencies.find((c) =>
      c.levels.some((l) => l.value === 0),
    )!;
    await putResponse(mixSelf.id, mix15.id, collabToken, {
      scaleLevelId: levelByValue(mix15, 4).id,
    }).expect(200);
    await putResponse(mixSelf.id, mix010.id, collabToken, {
      scaleLevelId: levelByValue(mix010, 8).id,
    }).expect(200);
    const mixSubmit = await request(app.getHttpServer())
      .post(`/performance/evaluations/${mixSelf.id}/submit`)
      .set(auth(collabToken))
      .expect(201);
    expect((mixSubmit.body as EvaluationDetail).scorePercentage).toBe('77.50');
  });

  it('keeps SELF/MANAGER scores independent, participant ACTIVE, and enforces privacy', async () => {
    const compId = await createCompetency(
      `Indep ${suffix}`,
      `IND-${suffix.slice(0, 6)}`,
    );
    const cycleId = await createActiveCycle(`Indep ${suffix}`, [
      {
        competencyId: compId,
        scaleId: scale15Id,
        weight: null,
        required: true,
      },
    ]);
    const assigned = await assignParticipant(cycleId, employeeAId);
    const self = assigned.evaluations.find((e) => e.type === 'SELF')!;
    const manager = assigned.evaluations.find((e) => e.type === 'MANAGER')!;
    expect(manager).toBeTruthy();

    await putResponse(self.id, self.competencies[0].id, collabToken, {
      scaleLevelId: levelByValue(self.competencies[0], 5).id,
    }).expect(200);
    const selfSubmit = await request(app.getHttpServer())
      .post(`/performance/evaluations/${self.id}/submit`)
      .set(auth(collabToken))
      .expect(201);
    expect((selfSubmit.body as EvaluationDetail).scorePercentage).toBe(
      '100.00',
    );

    await request(app.getHttpServer())
      .get(`/performance/evaluations/${manager.id}`)
      .set(auth(collabToken))
      .expect(403);

    const pmRead = await request(app.getHttpServer())
      .get(`/performance/evaluations/${manager.id}`)
      .set(auth(perfManagerToken))
      .expect(200);
    expect((pmRead.body as EvaluationDetail).canRespond).toBe(false);

    await putResponse(
      manager.id,
      manager.competencies[0].id,
      perfManagerToken,
      {
        scaleLevelId: levelByValue(manager.competencies[0], 4).id,
      },
    ).expect(403);

    await putResponse(manager.id, manager.competencies[0].id, managerToken, {
      scaleLevelId: levelByValue(manager.competencies[0], 3).id,
    }).expect(200);
    const mgrSubmit = await request(app.getHttpServer())
      .post(`/performance/evaluations/${manager.id}/submit`)
      .set(auth(managerToken))
      .expect(201);
    expect((mgrSubmit.body as EvaluationDetail).scorePercentage).toBe('50.00');

    const participant =
      await prisma.performanceCycleParticipant.findUniqueOrThrow({
        where: { id: assigned.id },
      });
    expect(participant.status).toBe('ACTIVE');

    const mine = await request(app.getHttpServer())
      .get('/performance/evaluations/mine')
      .set(auth(collabToken))
      .expect(200);
    expect(
      (mine.body as { self: { id: string }[] }).self.some(
        (e) => e.id === self.id,
      ),
    ).toBe(true);
  });

  it('rejects cross-tenant, CLOSED cycle, EXCLUDED participant; concurrent save stays unique', async () => {
    const compId = await createCompetency(
      `Guard ${suffix}`,
      `GRD-${suffix.slice(0, 6)}`,
    );
    const cycleId = await createActiveCycle(`Guard ${suffix}`, [
      {
        competencyId: compId,
        scaleId: scale15Id,
        weight: null,
        required: true,
      },
    ]);
    const assigned = await assignParticipant(cycleId, employeeAId);
    const self = assigned.evaluations.find((e) => e.type === 'SELF')!;
    const level = levelByValue(self.competencies[0], 4);

    const buB = await prisma.businessUnit.create({
      data: { companyId: companyBId, name: `Resp BU B ${suffix}` },
    });
    const areaB = await prisma.area.create({
      data: {
        companyId: companyBId,
        businessUnitId: buB.id,
        name: `Resp Area B ${suffix}`,
      },
    });
    const jlB = await prisma.jobLevel.create({
      data: {
        companyId: companyBId,
        name: `Resp JL B ${suffix}`,
        rank: 1,
      },
    });
    const posB = await prisma.position.create({
      data: {
        companyId: companyBId,
        areaId: areaB.id,
        jobLevelId: jlB.id,
        name: `Resp Pos B ${suffix}`,
      },
    });
    const hash = await hasher.hash(password);
    const collabBUser = await prisma.user.create({
      data: {
        email: `resp-collab-b-${suffix}@example.com`,
        passwordHash: hash,
        firstName: 'Resp',
        lastName: 'CollabB',
        status: UserStatus.ACTIVE,
      },
    });
    const roleCollab = await prisma.role.findUniqueOrThrow({
      where: { scope_code: { scope: RoleScope.COMPANY, code: 'COLLABORATOR' } },
    });
    const membershipB = await prisma.companyMembership.create({
      data: {
        userId: collabBUser.id,
        companyId: companyBId,
        status: MembershipStatus.ACTIVE,
      },
    });
    await prisma.membershipRole.create({
      data: { membershipId: membershipB.id, roleId: roleCollab.id },
    });
    await prisma.employee.create({
      data: {
        companyId: companyBId,
        firstName: 'Cross',
        lastName: 'Tenant',
        email: `resp-cross-${suffix}@example.com`,
        areaId: areaB.id,
        positionId: posB.id,
        status: EmployeeStatus.ACTIVE,
        userId: collabBUser.id,
      },
    });
    const collabBToken = await login(`resp-collab-b-${suffix}@example.com`);

    await request(app.getHttpServer())
      .put(
        `/performance/evaluations/${self.id}/competencies/${self.competencies[0].id}/response`,
      )
      .set(auth(collabBToken, companyBId))
      .send({ scaleLevelId: level.id })
      .expect(404);

    await request(app.getHttpServer())
      .get(`/performance/evaluations/${self.id}`)
      .set(auth(adminBToken, companyBId))
      .expect(404);

    const closedCycleId = await createActiveCycle(`CloseResp ${suffix}`, [
      {
        competencyId: await createCompetency(
          `CloseComp ${suffix}`,
          `CLC-${suffix.slice(0, 5)}`,
        ),
        scaleId: scale15Id,
        weight: null,
      },
    ]);
    const closedAssigned = await assignParticipant(
      closedCycleId,
      employeeNoMgrId,
    );
    const closedSelf = closedAssigned.evaluations.find(
      (e) => e.type === 'SELF',
    )!;
    // 08D: close rejects ACTIVE participants — exclude first.
    await request(app.getHttpServer())
      .post(
        `/performance/cycles/${closedCycleId}/participants/${closedAssigned.id}/exclude`,
      )
      .set(auth(adminToken))
      .expect(201);
    await request(app.getHttpServer())
      .post(`/performance/cycles/${closedCycleId}/close`)
      .set(auth(adminToken))
      .expect(201);

    await putResponse(
      closedSelf.id,
      closedSelf.competencies[0].id,
      leaderToken,
      {
        scaleLevelId: levelByValue(closedSelf.competencies[0], 3).id,
      },
    ).expect(400);
    await request(app.getHttpServer())
      .post(`/performance/evaluations/${closedSelf.id}/submit`)
      .set(auth(leaderToken))
      .expect(400);

    const exclCycleId = await createActiveCycle(`Excl ${suffix}`, [
      {
        competencyId: await createCompetency(
          `ExclComp ${suffix}`,
          `EXC-${suffix.slice(0, 5)}`,
        ),
        scaleId: scale15Id,
        weight: null,
      },
    ]);
    const exclAssigned = await assignParticipant(exclCycleId, employeeAId);
    const exclSelf = exclAssigned.evaluations.find((e) => e.type === 'SELF')!;
    await request(app.getHttpServer())
      .post(
        `/performance/cycles/${exclCycleId}/participants/${exclAssigned.id}/exclude`,
      )
      .set(auth(adminToken))
      .expect(201);

    await putResponse(exclSelf.id, exclSelf.competencies[0].id, collabToken, {
      scaleLevelId: levelByValue(exclSelf.competencies[0], 2).id,
    }).expect(400);
    await request(app.getHttpServer())
      .post(`/performance/evaluations/${exclSelf.id}/submit`)
      .set(auth(collabToken))
      .expect(400);

    const raceCompId = await createCompetency(
      `Race ${suffix}`,
      `RAC-${suffix.slice(0, 6)}`,
    );
    const raceCycleId = await createActiveCycle(`Race ${suffix}`, [
      {
        competencyId: raceCompId,
        scaleId: scale15Id,
        weight: null,
      },
    ]);
    const raceAssigned = await assignParticipant(raceCycleId, employeeNoMgrId);
    const raceSelf = raceAssigned.evaluations.find((e) => e.type === 'SELF')!;
    const raceComp = raceSelf.competencies[0];
    const level3 = levelByValue(raceComp, 3);
    const level5 = levelByValue(raceComp, 5);

    const concurrent = await Promise.all([
      putResponse(raceSelf.id, raceComp.id, leaderToken, {
        scaleLevelId: level3.id,
        comment: 'a',
      }),
      putResponse(raceSelf.id, raceComp.id, leaderToken, {
        scaleLevelId: level5.id,
        comment: 'b',
      }),
    ]);
    expect(concurrent.every((r) => r.status === 200)).toBe(true);

    const rows = await prisma.performanceEvaluationResponse.findMany({
      where: {
        evaluationId: raceSelf.id,
        evaluationCompetencyId: raceComp.id,
      },
    });
    expect(rows).toHaveLength(1);
    expect([3, 5]).toContain(rows[0].ratingValue);
  });
});
