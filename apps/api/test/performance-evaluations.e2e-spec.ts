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
import { PERFORMANCE_AUDIT } from '../src/performance/performance.constants';
import { snapshotFingerprint } from '../src/performance/evaluation-access';

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

describe('Performance evaluations 08B (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let hasher: PasswordHashingService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const password = `EvalPass-${suffix}!`;

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
  let employeeCollabUserId = '';
  let employeeLeaderUserId = '';
  let employeeManagerUserId = '';
  let cycleId = '';
  let competencyId = '';
  let scaleId = '';

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
        name: `Eval A ${suffix}`,
        slug: `eval-a-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    const companyB = await prisma.company.create({
      data: {
        name: `Eval B ${suffix}`,
        slug: `eval-b-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    companyAId = companyA.id;
    companyBId = companyB.id;

    const bu = await prisma.businessUnit.create({
      data: { companyId: companyAId, name: `Eval BU ${suffix}` },
    });
    const area = await prisma.area.create({
      data: {
        companyId: companyAId,
        businessUnitId: bu.id,
        name: `Eval Area ${suffix}`,
      },
    });
    areaAId = area.id;
    const jl = await prisma.jobLevel.create({
      data: {
        companyId: companyAId,
        name: `Eval JL ${suffix}`,
        rank: 3000 + Math.floor(Math.random() * 500),
      },
    });
    const position = await prisma.position.create({
      data: {
        companyId: companyAId,
        areaId: areaAId,
        jobLevelId: jl.id,
        name: `Eval Pos ${suffix}`,
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
          firstName: 'Eval',
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
      `eval-admin-${suffix}@example.com`,
      'CLIENT_ADMIN',
      companyAId,
    );
    await createUser(
      `eval-pm-${suffix}@example.com`,
      'PERFORMANCE_MANAGER',
      companyAId,
    );
    const leaderUser = await createUser(
      `eval-leader-${suffix}@example.com`,
      'LEADER',
      companyAId,
    );
    const collabUser = await createUser(
      `eval-collab-${suffix}@example.com`,
      'COLLABORATOR',
      companyAId,
    );
    const managerUser = await createUser(
      `eval-manager-${suffix}@example.com`,
      'LEADER',
      companyAId,
    );
    await createUser(
      `eval-admin-b-${suffix}@example.com`,
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
          lastName: 'Eval',
          email,
          areaId: areaAId,
          positionId: positionAId,
          status: EmployeeStatus.ACTIVE,
          ...(userId ? { userId } : {}),
        },
      });

    const empA = await createEmp(
      'Alice',
      `alice-${suffix}@example.com`,
      collabUser.id,
    );
    const empB = await createEmp(
      'Bob',
      `bob-${suffix}@example.com`,
      managerUser.id,
    );
    const empNoMgr = await createEmp(
      'Solo',
      `solo-${suffix}@example.com`,
      leaderUser.id,
    );
    employeeAId = empA.id;
    employeeBId = empB.id;
    employeeNoMgrId = empNoMgr.id;
    employeeCollabUserId = collabUser.id;
    employeeLeaderUserId = leaderUser.id;
    employeeManagerUserId = managerUser.id;

    await prisma.employeeReportingLine.create({
      data: {
        companyId: companyAId,
        employeeId: employeeAId,
        managerEmployeeId: employeeBId,
        type: ReportingLineType.DIRECT,
      },
    });

    adminToken = await login(`eval-admin-${suffix}@example.com`);
    perfManagerToken = await login(`eval-pm-${suffix}@example.com`);
    leaderToken = await login(`eval-leader-${suffix}@example.com`);
    collabToken = await login(`eval-collab-${suffix}@example.com`);
    managerToken = await login(`eval-manager-${suffix}@example.com`);
    adminBToken = await login(`eval-admin-b-${suffix}@example.com`);

    // Configure ACTIVE cycle with competency+scale
    const scale = await request(app.getHttpServer())
      .post('/performance/scales')
      .set(auth(adminToken))
      .send({ name: `Escala eval ${suffix}` })
      .expect(201);
    scaleId = (scale.body as { id: string }).id;
    for (let i = 1; i <= 3; i += 1) {
      await request(app.getHttpServer())
        .post(`/performance/scales/${scaleId}/levels`)
        .set(auth(adminToken))
        .send({ value: i, label: `N${i}`, order: i, description: `Desc ${i}` })
        .expect(201);
    }

    const comp = await request(app.getHttpServer())
      .post('/performance/competencies')
      .set(auth(adminToken))
      .send({
        name: `Comunicación ${suffix}`,
        code: `COM-${suffix.slice(0, 6)}`,
        description: 'Original description',
      })
      .expect(201);
    competencyId = (comp.body as { id: string }).id;

    const cycle = await request(app.getHttpServer())
      .post('/performance/cycles')
      .set(auth(adminToken))
      .send({
        name: `Ciclo eval ${suffix}`,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      })
      .expect(201);
    cycleId = (cycle.body as { id: string }).id;

    await request(app.getHttpServer())
      .post(`/performance/cycles/${cycleId}/competencies`)
      .set(auth(adminToken))
      .send({
        competencyId,
        scaleId,
        weight: 100,
        order: 0,
        required: true,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/performance/cycles/${cycleId}/activate`)
      .set(auth(adminToken))
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('rejects assignment on DRAFT and allows ACTIVE with SELF+MANAGER', async () => {
    const draft = await request(app.getHttpServer())
      .post('/performance/cycles')
      .set(auth(adminToken))
      .send({
        name: `Draft ${suffix}`,
        startDate: '2026-01-01',
        endDate: '2026-06-30',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/performance/cycles/${(draft.body as { id: string }).id}/participants`,
      )
      .set(auth(adminToken))
      .send({ employeeId: employeeAId })
      .expect(400);

    const assigned = await request(app.getHttpServer())
      .post(`/performance/cycles/${cycleId}/participants`)
      .set(auth(adminToken))
      .send({ employeeId: employeeAId })
      .expect(201);

    const body = assigned.body as {
      id: string;
      managerEvaluationCreated: boolean;
      evaluations: Array<{
        type: string;
        evaluatorEmployeeId: string;
        competencies: Array<{
          name: string;
          description: string | null;
          scaleName: string;
          sourceCompetencyId: string | null;
          levels: Array<{ value: number; label: string; order: number }>;
        }>;
      }>;
    };

    expect(body.managerEvaluationCreated).toBe(true);
    expect(body.evaluations).toHaveLength(2);
    const self = body.evaluations.find((e) => e.type === 'SELF')!;
    const manager = body.evaluations.find((e) => e.type === 'MANAGER')!;
    expect(self.evaluatorEmployeeId).toBe(employeeAId);
    expect(manager.evaluatorEmployeeId).toBe(employeeBId);

    const selfSnap = self.competencies[0];
    expect(selfSnap.name).toBe(`Comunicación ${suffix}`);
    expect(self.competencies).toHaveLength(manager.competencies.length);
    expect(self.competencies[0].name).toBe(manager.competencies[0].name);
    expect(self.competencies[0].levels.map((l) => l.label)).toEqual(
      manager.competencies[0].levels.map((l) => l.label),
    );
    expect(
      snapshotFingerprint([
        {
          sourceCompetencyId: selfSnap.sourceCompetencyId!,
          sourceScaleId: scaleId,
          name: selfSnap.name,
          code: null,
          description: selfSnap.description,
          scaleName: selfSnap.scaleName,
          weight: '100.00',
          required: true,
          order: 0,
          levels: selfSnap.levels.map((l) => ({
            sourceScaleLevelId: 'x',
            value: l.value,
            label: l.label,
            description: null,
            order: l.order,
          })),
        },
      ]),
    ).toContain(selfSnap.name);

    await request(app.getHttpServer())
      .post(`/performance/cycles/${cycleId}/participants`)
      .set(auth(adminToken))
      .send({ employeeId: employeeAId })
      .expect(409);
  });

  it('creates SELF only when employee has no DIRECT manager', async () => {
    const res = await request(app.getHttpServer())
      .post(`/performance/cycles/${cycleId}/participants`)
      .set(auth(adminToken))
      .send({ employeeId: employeeNoMgrId })
      .expect(201);
    const body = res.body as {
      managerEvaluationCreated: boolean;
      reason?: string;
      evaluations: { type: string }[];
    };
    expect(body.managerEvaluationCreated).toBe(false);
    expect(body.reason).toBe('NO_DIRECT_MANAGER');
    expect(body.evaluations).toHaveLength(1);
    expect(body.evaluations[0].type).toBe('SELF');
  });

  it('bulk assign reports alreadyAssigned and rejects cross-tenant', async () => {
    const empExtra = await prisma.employee.create({
      data: {
        companyId: companyAId,
        firstName: 'Extra',
        lastName: 'Eval',
        email: `extra-${suffix}@example.com`,
        areaId: areaAId,
        positionId: positionAId,
      },
    });

    const bulk = await request(app.getHttpServer())
      .post(`/performance/cycles/${cycleId}/participants/bulk`)
      .set(auth(adminToken))
      .send({ employeeIds: [employeeAId, empExtra.id] })
      .expect(201);

    const result = bulk.body as {
      created: unknown[];
      alreadyAssigned: string[];
      failed: unknown[];
    };
    expect(result.alreadyAssigned).toContain(employeeAId);
    expect(result.created).toHaveLength(1);

    const foreign = await prisma.employee.create({
      data: {
        companyId: companyBId,
        firstName: 'Foreign',
        lastName: 'Eval',
        email: `foreign-${suffix}@example.com`,
        areaId: (
          await prisma.area.create({
            data: {
              companyId: companyBId,
              name: `B Area ${suffix}`,
              businessUnitId: (
                await prisma.businessUnit.create({
                  data: { companyId: companyBId, name: `B BU ${suffix}` },
                })
              ).id,
            },
          })
        ).id,
        positionId: (
          await prisma.position.create({
            data: {
              companyId: companyBId,
              areaId: (
                await prisma.area.findFirstOrThrow({
                  where: { companyId: companyBId },
                })
              ).id,
              jobLevelId: (
                await prisma.jobLevel.create({
                  data: {
                    companyId: companyBId,
                    name: `B JL ${suffix}`,
                    rank: 1,
                  },
                })
              ).id,
              name: `B Pos ${suffix}`,
            },
          })
        ).id,
      },
    });

    await request(app.getHttpServer())
      .post(`/performance/cycles/${cycleId}/participants/bulk`)
      .set(auth(adminToken))
      .send({ employeeIds: [foreign.id] })
      .expect(400);
  });

  it('keeps snapshots after catalog change and historical manager after reporting change', async () => {
    const list = await request(app.getHttpServer())
      .get(`/performance/cycles/${cycleId}/participants`)
      .set(auth(adminToken))
      .expect(200);
    const alice = (
      list.body as {
        items: Array<{
          employeeId: string;
          evaluations: { self: { id: string }; manager: { id: string } | null };
        }>;
      }
    ).items.find((i) => i.employeeId === employeeAId)!;

    const before = await request(app.getHttpServer())
      .get(`/performance/evaluations/${alice.evaluations.self.id}`)
      .set(auth(adminToken))
      .expect(200);
    const originalName = (before.body as { competencies: { name: string }[] })
      .competencies[0].name;
    const originalLevels = (
      before.body as {
        competencies: { levels: { label: string }[] }[];
      }
    ).competencies[0].levels.map((l) => l.label);

    await request(app.getHttpServer())
      .patch(`/performance/competencies/${competencyId}`)
      .set(auth(adminToken))
      .send({ name: `RENAMED ${suffix}`, description: 'changed' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(
        `/performance/scales/${scaleId}/levels/${
          (
            await prisma.competencyScaleLevel.findFirstOrThrow({
              where: { scaleId, value: 1 },
            })
          ).id
        }`,
      )
      .set(auth(adminToken))
      .send({ label: 'CHANGED LABEL' })
      .expect(200);

    const after = await request(app.getHttpServer())
      .get(`/performance/evaluations/${alice.evaluations.self.id}`)
      .set(auth(adminToken))
      .expect(200);
    expect(
      (after.body as { competencies: { name: string }[] }).competencies[0].name,
    ).toBe(originalName);
    expect(
      (
        after.body as {
          competencies: { levels: { label: string }[] }[];
        }
      ).competencies[0].levels.map((l) => l.label),
    ).toEqual(originalLevels);

    const managerEvalId = alice.evaluations.manager!.id;
    const mgrEval = await request(app.getHttpServer())
      .get(`/performance/evaluations/${managerEvalId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(
      (mgrEval.body as { evaluatorEmployeeId: string }).evaluatorEmployeeId,
    ).toBe(employeeBId);

    // Change reporting line: remove DIRECT and point elsewhere — historical evaluator stays
    await prisma.employeeReportingLine.deleteMany({
      where: { employeeId: employeeAId, type: ReportingLineType.DIRECT },
    });
    await prisma.employeeReportingLine.create({
      data: {
        companyId: companyAId,
        employeeId: employeeAId,
        managerEmployeeId: employeeNoMgrId,
        type: ReportingLineType.DIRECT,
      },
    });

    const mgrEval2 = await request(app.getHttpServer())
      .get(`/performance/evaluations/${managerEvalId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(
      (mgrEval2.body as { evaluatorEmployeeId: string }).evaluatorEmployeeId,
    ).toBe(employeeBId);
  });

  it('mine + resource authorization + tenant isolation', async () => {
    const collabMine = await request(app.getHttpServer())
      .get('/performance/evaluations/mine')
      .set(auth(collabToken))
      .expect(200);
    const collabBody = collabMine.body as {
      self: { id: string }[];
      asManager: unknown[];
    };
    expect(collabBody.self.length).toBeGreaterThan(0);
    expect(collabBody.asManager).toHaveLength(0);

    const managerMine = await request(app.getHttpServer())
      .get('/performance/evaluations/mine')
      .set(auth(managerToken))
      .expect(200);
    expect(
      (managerMine.body as { asManager: unknown[] }).asManager.length,
    ).toBeGreaterThan(0);

    const selfId = collabBody.self[0].id;
    await request(app.getHttpServer())
      .get(`/performance/evaluations/${selfId}`)
      .set(auth(collabToken))
      .expect(200);

    // Leader (solo employee) cannot read Alice SELF
    await request(app.getHttpServer())
      .get(`/performance/evaluations/${selfId}`)
      .set(auth(leaderToken))
      .expect(403);

    // Manager can read MANAGER eval for Alice
    const participants = await request(app.getHttpServer())
      .get(`/performance/cycles/${cycleId}/participants`)
      .set(auth(perfManagerToken))
      .expect(200);
    const alice = (
      participants.body as {
        items: Array<{
          employeeId: string;
          evaluations: { manager: { id: string } | null };
        }>;
      }
    ).items.find((i) => i.employeeId === employeeAId)!;
    await request(app.getHttpServer())
      .get(`/performance/evaluations/${alice.evaluations.manager!.id}`)
      .set(auth(managerToken))
      .expect(200);

    // Collaborator cannot read manager evaluation
    await request(app.getHttpServer())
      .get(`/performance/evaluations/${alice.evaluations.manager!.id}`)
      .set(auth(collabToken))
      .expect(403);

    // Cross-tenant 404
    await request(app.getHttpServer())
      .get(`/performance/evaluations/${selfId}`)
      .set(auth(adminBToken, companyBId))
      .expect(404);

    await request(app.getHttpServer())
      .get(`/performance/cycles/${cycleId}/participants`)
      .set(auth(adminBToken, companyBId))
      .expect(404);
  });

  it('excludes participant and writes audit; concurrent duplicate assign', async () => {
    const emp = await prisma.employee.create({
      data: {
        companyId: companyAId,
        firstName: 'Exclude',
        lastName: 'Me',
        email: `exclude-${suffix}@example.com`,
        areaId: areaAId,
        positionId: positionAId,
      },
    });
    const created = await request(app.getHttpServer())
      .post(`/performance/cycles/${cycleId}/participants`)
      .set(auth(adminToken))
      .send({ employeeId: emp.id })
      .expect(201);
    const participantId = (created.body as { id: string }).id;

    await request(app.getHttpServer())
      .post(
        `/performance/cycles/${cycleId}/participants/${participantId}/exclude`,
      )
      .set(auth(adminToken))
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/performance/cycles/${cycleId}/participants/${participantId}/exclude`,
      )
      .set(auth(adminToken))
      .expect(409);

    const audits = await prisma.auditLog.findMany({
      where: {
        companyId: companyAId,
        action: {
          in: [
            PERFORMANCE_AUDIT.PERFORMANCE_PARTICIPANT_ADDED,
            PERFORMANCE_AUDIT.PERFORMANCE_PARTICIPANT_EXCLUDED,
            PERFORMANCE_AUDIT.PERFORMANCE_EVALUATION_CREATED,
          ],
        },
      },
    });
    expect(audits.length).toBeGreaterThan(0);

    const emp2 = await prisma.employee.create({
      data: {
        companyId: companyAId,
        firstName: 'Race',
        lastName: 'Me',
        email: `race-${suffix}@example.com`,
        areaId: areaAId,
        positionId: positionAId,
      },
    });
    const results = await Promise.all([
      request(app.getHttpServer())
        .post(`/performance/cycles/${cycleId}/participants`)
        .set(auth(adminToken))
        .send({ employeeId: emp2.id }),
      request(app.getHttpServer())
        .post(`/performance/cycles/${cycleId}/participants`)
        .set(auth(perfManagerToken))
        .send({ employeeId: emp2.id }),
    ]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toContain(201);
    expect(statuses.some((s) => s === 409)).toBe(true);

    // CLOSED rejects new assignments
    const closeCycle = await request(app.getHttpServer())
      .post('/performance/cycles')
      .set(auth(adminToken))
      .send({
        name: `Close ${suffix}`,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      })
      .expect(201);
    const closeId = (closeCycle.body as { id: string }).id;
    await request(app.getHttpServer())
      .post(`/performance/cycles/${closeId}/competencies`)
      .set(auth(adminToken))
      .send({ competencyId, scaleId, weight: 100 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/performance/cycles/${closeId}/activate`)
      .set(auth(adminToken))
      .expect(201);
    await request(app.getHttpServer())
      .post(`/performance/cycles/${closeId}/close`)
      .set(auth(adminToken))
      .expect(201);
    await request(app.getHttpServer())
      .post(`/performance/cycles/${closeId}/participants`)
      .set(auth(adminToken))
      .send({ employeeId: emp2.id })
      .expect(400);

    // CANCELLED rejects new assignments
    const cancelCycle = await request(app.getHttpServer())
      .post('/performance/cycles')
      .set(auth(adminToken))
      .send({
        name: `Cancel ${suffix}`,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      })
      .expect(201);
    const cancelId = (cancelCycle.body as { id: string }).id;
    await request(app.getHttpServer())
      .post(`/performance/cycles/${cancelId}/competencies`)
      .set(auth(adminToken))
      .send({ competencyId, scaleId, weight: 100 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/performance/cycles/${cancelId}/cancel`)
      .set(auth(adminToken))
      .expect(201);
    await request(app.getHttpServer())
      .post(`/performance/cycles/${cancelId}/participants`)
      .set(auth(adminToken))
      .send({ employeeId: emp2.id })
      .expect(400);

    void employeeCollabUserId;
    void employeeLeaderUserId;
    void employeeManagerUserId;
  });
});
