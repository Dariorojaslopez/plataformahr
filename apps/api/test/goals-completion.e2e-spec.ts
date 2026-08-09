/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
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
import { GOALS_AUDIT } from '../src/goals/goals.constants';

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

describe('Goals completion (09C)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let hasher: PasswordHashingService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const password = `GoalComp-${suffix}!`;

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
  let collabBToken = '';
  let employeeAId = '';
  let employeeBId = '';
  let leaderEmployeeId = '';
  let cycleId = '';
  let adminUserId = '';

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
        name: `GC A ${suffix}`,
        slug: `gc-a-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    const companyB = await prisma.company.create({
      data: {
        name: `GC B ${suffix}`,
        slug: `gc-b-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    companyAId = companyA.id;
    companyBId = companyB.id;

    const areaA = await prisma.area.create({
      data: { companyId: companyAId, name: `GCA ${suffix}` },
    });
    const areaB = await prisma.area.create({
      data: { companyId: companyAId, name: `GCB ${suffix}` },
    });
    areaAId = areaA.id;
    areaBId = areaB.id;
    const jl = await prisma.jobLevel.create({
      data: {
        companyId: companyAId,
        name: `GC JL ${suffix}`,
        rank: 9000 + Math.floor(Math.random() * 400),
      },
    });
    const position = await prisma.position.create({
      data: {
        companyId: companyAId,
        areaId: areaAId,
        jobLevelId: jl.id,
        name: `GC Pos ${suffix}`,
        headcount: 20,
      },
    });
    positionAId = position.id;

    const permissions = [
      'goals.cycle.read',
      'goals.cycle.manage',
      'goals.goal.read',
      'goals.goal.manage',
      'goals.goal.assign',
      'goals.progress.update',
      'goals.completion.request',
      'goals.completion.review',
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

    const byRole: Record<string, string[]> = {
      CLIENT_ADMIN: [...permissions],
      PERFORMANCE_MANAGER: [...permissions],
      LEADER: [
        'goals.cycle.read',
        'goals.goal.read',
        'goals.completion.review',
      ],
      COLLABORATOR: [
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
          firstName: 'GC',
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

    const adminUser = await createUser(
      `gc-admin-${suffix}@example.com`,
      'CLIENT_ADMIN',
      companyAId,
    );
    adminUserId = adminUser.id;
    await createUser(
      `gc-pm-${suffix}@example.com`,
      'PERFORMANCE_MANAGER',
      companyAId,
    );
    const leaderUser = await createUser(
      `gc-leader-${suffix}@example.com`,
      'LEADER',
      companyAId,
    );
    const collabUser = await createUser(
      `gc-collab-${suffix}@example.com`,
      'COLLABORATOR',
      companyAId,
    );
    const collabBUser = await createUser(
      `gc-collab-b-${suffix}@example.com`,
      'COLLABORATOR',
      companyAId,
    );
    await createUser(
      `gc-admin-b-${suffix}@example.com`,
      'CLIENT_ADMIN',
      companyBId,
    );

    const empLeader = await prisma.employee.create({
      data: {
        companyId: companyAId,
        firstName: 'Leader',
        lastName: 'GC',
        email: `gc-leader-emp-${suffix}@example.com`,
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
        lastName: 'GC',
        email: `gc-ana-${suffix}@example.com`,
        areaId: areaAId,
        positionId: positionAId,
        status: EmployeeStatus.ACTIVE,
        userId: collabUser.id,
      },
    });
    const empB = await prisma.employee.create({
      data: {
        companyId: companyAId,
        firstName: 'Bob',
        lastName: 'GC',
        email: `gc-bob-${suffix}@example.com`,
        areaId: areaBId,
        positionId: positionAId,
        status: EmployeeStatus.ACTIVE,
        userId: collabBUser.id,
      },
    });
    employeeAId = empA.id;
    employeeBId = empB.id;
    leaderEmployeeId = empLeader.id;

    await prisma.employeeReportingLine.create({
      data: {
        companyId: companyAId,
        employeeId: employeeAId,
        managerEmployeeId: leaderEmployeeId,
        type: ReportingLineType.DIRECT,
      },
    });

    adminToken = await login(`gc-admin-${suffix}@example.com`);
    pmToken = await login(`gc-pm-${suffix}@example.com`);
    leaderToken = await login(`gc-leader-${suffix}@example.com`);
    collabToken = await login(`gc-collab-${suffix}@example.com`);
    collabBToken = await login(`gc-collab-b-${suffix}@example.com`);
    adminBToken = await login(`gc-admin-b-${suffix}@example.com`);

    const cycleRes = await request(app.getHttpServer())
      .post('/goals/cycles')
      .set(auth(adminToken))
      .send({
        name: `GC Cycle ${suffix}`,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      })
      .expect(201);
    cycleId = cycleRes.body.id;
    await request(app.getHttpServer())
      .post(`/goals/cycles/${cycleId}/activate`)
      .set(auth(adminToken))
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  async function activateGoal(goalId: string) {
    await request(app.getHttpServer())
      .post(`/goals/${goalId}/activate`)
      .set(auth(adminToken))
      .expect(201);
  }

  it('completion workflow, result snapshots, reviewer rules and freezes', async () => {
    // INDIVIDUAL increase sales
    const indiv = await request(app.getHttpServer())
      .post('/goals')
      .set(auth(adminToken))
      .send({ cycleId, title: 'Aumentar ventas', type: 'INDIVIDUAL' })
      .expect(201);
    const indivId = indiv.body.id as string;
    await request(app.getHttpServer())
      .post(`/goals/${indivId}/assignments`)
      .set(auth(adminToken))
      .send({ employeeId: employeeAId })
      .expect(201);
    const kr = await request(app.getHttpServer())
      .post(`/goals/${indivId}/key-results`)
      .set(auth(adminToken))
      .send({
        title: 'Ventas',
        metricType: 'NUMBER',
        direction: 'INCREASE',
        startValue: 0,
        targetValue: 100,
      })
      .expect(201);
    const krId = kr.body.id as string;
    await activateGoal(indivId);

    // missing check-in blocks request
    await request(app.getHttpServer())
      .post(`/goals/${indivId}/completion-requests`)
      .set(auth(collabToken))
      .send({})
      .expect(400);

    for (const v of [20, 60, 85]) {
      await request(app.getHttpServer())
        .post(`/goals/${indivId}/key-results/${krId}/check-ins`)
        .set(auth(collabToken))
        .send({ numericValue: v })
        .expect(201);
    }

    // non-responsible cannot request
    await request(app.getHttpServer())
      .post(`/goals/${indivId}/completion-requests`)
      .set(auth(collabBToken))
      .send({})
      .expect(403);

    // draft cannot request
    const draft = await request(app.getHttpServer())
      .post('/goals')
      .set(auth(adminToken))
      .send({ cycleId, title: 'Draft', type: 'COMPANY' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/goals/${draft.body.id}/completion-requests`)
      .set(auth(adminToken))
      .send({})
      .expect(400);

    // responsible requests
    const req1 = await request(app.getHttpServer())
      .post(`/goals/${indivId}/completion-requests`)
      .set(auth(collabToken))
      .send({ requestComment: '  Cierre Q4  ' })
      .expect(201);
    expect(req1.body.status).toBe('PENDING');
    expect(req1.body.requestComment).toBe('Cierre Q4');
    const requestId = req1.body.id as string;

    // pending freezes check-in + second request + cancel
    await request(app.getHttpServer())
      .post(`/goals/${indivId}/key-results/${krId}/check-ins`)
      .set(auth(collabToken))
      .send({ numericValue: 90 })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/goals/${indivId}/completion-requests`)
      .set(auth(collabToken))
      .send({})
      .expect(409);
    await request(app.getHttpServer())
      .post(`/goals/${indivId}/cancel`)
      .set(auth(adminToken))
      .expect(409);

    // self approval denied
    await request(app.getHttpServer())
      .post(`/goals/completion-requests/${requestId}/approve`)
      .set(auth(collabToken))
      .send({})
      .expect(403);

    // reject requires comment
    await request(app.getHttpServer())
      .post(`/goals/completion-requests/${requestId}/reject`)
      .set(auth(leaderToken))
      .send({ reviewComment: '' })
      .expect(400);

    // leader DIRECT can reject
    await request(app.getHttpServer())
      .post(`/goals/completion-requests/${requestId}/reject`)
      .set(auth(leaderToken))
      .send({ reviewComment: 'Falta consolidar cierre mensual.' })
      .expect(201);

    // after reject check-in + re-request works
    await request(app.getHttpServer())
      .post(`/goals/${indivId}/key-results/${krId}/check-ins`)
      .set(auth(collabToken))
      .send({ numericValue: 85 })
      .expect(201);
    const req2 = await request(app.getHttpServer())
      .post(`/goals/${indivId}/completion-requests`)
      .set(auth(collabToken))
      .send({})
      .expect(201);
    const requestId2 = req2.body.id as string;

    // leader approve
    const approved = await request(app.getHttpServer())
      .post(`/goals/completion-requests/${requestId2}/approve`)
      .set(auth(leaderToken))
      .send({ reviewComment: 'OK' })
      .expect(201);
    expect(approved.body.achievementPercentage).toBe('85');
    expect(approved.body.keyResults).toHaveLength(1);
    expect(approved.body.keyResults[0].finalNumericValue).toBe('85');

    const goal = await request(app.getHttpServer())
      .get(`/goals/${indivId}`)
      .set(auth(collabToken))
      .expect(200);
    expect(goal.body.status).toBe('COMPLETED');
    expect(goal.body.achievementPercentage).toBe('85');

    // COMPLETED cannot check-in / cancel
    await request(app.getHttpServer())
      .post(`/goals/${indivId}/key-results/${krId}/check-ins`)
      .set(auth(adminToken))
      .send({ numericValue: 99 })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/goals/${indivId}/cancel`)
      .set(auth(adminToken))
      .expect(400);

    // historical: mutate source KR via prisma; result unchanged
    await prisma.goalKeyResult.update({
      where: { id: krId },
      data: { targetValue: 200 },
    });
    const result = await request(app.getHttpServer())
      .get(`/goals/${indivId}/result`)
      .set(auth(collabToken))
      .expect(200);
    expect(result.body.keyResults[0].targetNumericValue).toBe('100');
    expect(result.body.achievementPercentage).toBe('85');

    // mine includes COMPLETED, excludes cancelled later
    const mine = await request(app.getHttpServer())
      .get('/goals/mine')
      .set(auth(collabToken))
      .expect(200);
    expect(mine.body.items.some((g: { id: string }) => g.id === indivId)).toBe(
      true,
    );
    expect(
      mine.body.items.find((g: { id: string }) => g.id === indivId)
        ?.achievementPercentage,
    ).toBe('85');

    // team includes COMPLETED
    const team = await request(app.getHttpServer())
      .get('/goals/team')
      .set(auth(leaderToken))
      .expect(200);
    const ana = team.body.employees.find(
      (e: { employee: { id: string } }) => e.employee.id === employeeAId,
    );
    expect(ana.goals.some((g: { id: string }) => g.id === indivId)).toBe(true);

    // AREA: leader cannot review
    const areaGoal = await request(app.getHttpServer())
      .post('/goals')
      .set(auth(adminToken))
      .send({
        cycleId,
        title: 'Area goal',
        type: 'AREA',
        areaId: areaAId,
      })
      .expect(201);
    const areaGoalId = areaGoal.body.id as string;
    await request(app.getHttpServer())
      .post(`/goals/${areaGoalId}/assignments`)
      .set(auth(adminToken))
      .send({ employeeId: employeeAId })
      .expect(201);
    const areaKr = await request(app.getHttpServer())
      .post(`/goals/${areaGoalId}/key-results`)
      .set(auth(adminToken))
      .send({
        title: 'SLA',
        metricType: 'NUMBER',
        direction: 'DECREASE',
        startValue: 10,
        targetValue: 2,
        weight: 70,
      })
      .expect(201);
    const areaKr2 = await request(app.getHttpServer())
      .post(`/goals/${areaGoalId}/key-results`)
      .set(auth(adminToken))
      .send({
        title: 'Bool',
        metricType: 'BOOLEAN',
        targetBoolean: true,
        weight: 30,
      })
      .expect(201);
    await activateGoal(areaGoalId);
    await request(app.getHttpServer())
      .post(`/goals/${areaGoalId}/key-results/${areaKr.body.id}/check-ins`)
      .set(auth(collabToken))
      .send({ numericValue: 6 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/goals/${areaGoalId}/key-results/${areaKr2.body.id}/check-ins`)
      .set(auth(collabToken))
      .send({ booleanValue: true })
      .expect(201);
    const areaReq = await request(app.getHttpServer())
      .post(`/goals/${areaGoalId}/completion-requests`)
      .set(auth(adminToken))
      .send({})
      .expect(201);
    await request(app.getHttpServer())
      .post(`/goals/completion-requests/${areaReq.body.id}/approve`)
      .set(auth(leaderToken))
      .send({})
      .expect(403);
    // PM reviews AREA
    const areaApproved = await request(app.getHttpServer())
      .post(`/goals/completion-requests/${areaReq.body.id}/approve`)
      .set(auth(pmToken))
      .send({})
      .expect(201);
    // 50*0.7 + 100*0.3 = 65
    expect(areaApproved.body.achievementPercentage).toBe('65');

    // COMPANY admin request/approve with different users; overshoot clamp
    const companyGoal = await request(app.getHttpServer())
      .post('/goals')
      .set(auth(adminToken))
      .send({ cycleId, title: 'Company', type: 'COMPANY' })
      .expect(201);
    const companyGoalId = companyGoal.body.id as string;
    const cKr = await request(app.getHttpServer())
      .post(`/goals/${companyGoalId}/key-results`)
      .set(auth(adminToken))
      .send({
        title: 'Pct',
        metricType: 'PERCENTAGE',
        direction: 'INCREASE',
        startValue: 0,
        targetValue: 100,
      })
      .expect(201);
    await activateGoal(companyGoalId);
    await request(app.getHttpServer())
      .post(`/goals/${companyGoalId}/key-results/${cKr.body.id}/check-ins`)
      .set(auth(adminToken))
      .send({ numericValue: 120 })
      .expect(201);
    const cReq = await request(app.getHttpServer())
      .post(`/goals/${companyGoalId}/completion-requests`)
      .set(auth(adminToken))
      .send({})
      .expect(201);
    // leader cannot review COMPANY
    await request(app.getHttpServer())
      .post(`/goals/completion-requests/${cReq.body.id}/approve`)
      .set(auth(leaderToken))
      .send({})
      .expect(403);
    // self approve denied for admin who requested
    await request(app.getHttpServer())
      .post(`/goals/completion-requests/${cReq.body.id}/approve`)
      .set(auth(adminToken))
      .send({})
      .expect(403);
    const cApproved = await request(app.getHttpServer())
      .post(`/goals/completion-requests/${cReq.body.id}/approve`)
      .set(auth(pmToken))
      .send({})
      .expect(201);
    expect(cApproved.body.achievementPercentage).toBe('100');

    // CURRENCY unweighted on separate goal
    const curGoal = await request(app.getHttpServer())
      .post('/goals')
      .set(auth(adminToken))
      .send({ cycleId, title: 'Currency', type: 'COMPANY' })
      .expect(201);
    const curKr = await request(app.getHttpServer())
      .post(`/goals/${curGoal.body.id}/key-results`)
      .set(auth(adminToken))
      .send({
        title: 'COP',
        metricType: 'CURRENCY',
        direction: 'INCREASE',
        startValue: 0,
        targetValue: 20000000,
        currencyCode: 'COP',
      })
      .expect(201);
    await activateGoal(curGoal.body.id);
    await request(app.getHttpServer())
      .post(`/goals/${curGoal.body.id}/key-results/${curKr.body.id}/check-ins`)
      .set(auth(adminToken))
      .send({ numericValue: 10000000 })
      .expect(201);
    const curReq = await request(app.getHttpServer())
      .post(`/goals/${curGoal.body.id}/completion-requests`)
      .set(auth(pmToken))
      .send({})
      .expect(201);
    const curApproved = await request(app.getHttpServer())
      .post(`/goals/completion-requests/${curReq.body.id}/approve`)
      .set(auth(adminToken))
      .send({})
      .expect(201);
    expect(curApproved.body.achievementPercentage).toBe('50');
    expect(curApproved.body.keyResults[0].effectiveWeight).toBe('100');

    // cross-tenant
    await request(app.getHttpServer())
      .get(`/goals/${indivId}/result`)
      .set(auth(adminBToken, companyBId))
      .expect(404);
    await request(app.getHttpServer())
      .post(`/goals/${indivId}/completion-requests`)
      .set(auth(adminBToken, companyBId))
      .send({})
      .expect(404);

    // privacy: area employee non-responsible sees result without review comment
    // Bob is area B - company goals apply; he can see company result
    const bobResult = await request(app.getHttpServer())
      .get(`/goals/${companyGoalId}/result`)
      .set(auth(collabBToken))
      .expect(200);
    expect(bobResult.body.achievementPercentage).toBe('100');
    expect(bobResult.body.completionRequest?.reviewComment).toBeNull();

    // request history
    const hist = await request(app.getHttpServer())
      .get(`/goals/${indivId}/completion-requests`)
      .set(auth(collabToken))
      .expect(200);
    expect(hist.body.items.length).toBeGreaterThanOrEqual(2);

    // concurrent requests only one
    const raceGoal = await request(app.getHttpServer())
      .post('/goals')
      .set(auth(adminToken))
      .send({ cycleId, title: 'Race', type: 'COMPANY' })
      .expect(201);
    const raceKr = await request(app.getHttpServer())
      .post(`/goals/${raceGoal.body.id}/key-results`)
      .set(auth(adminToken))
      .send({
        title: 'r',
        metricType: 'NUMBER',
        direction: 'INCREASE',
        startValue: 0,
        targetValue: 10,
      })
      .expect(201);
    await activateGoal(raceGoal.body.id);
    await request(app.getHttpServer())
      .post(
        `/goals/${raceGoal.body.id}/key-results/${raceKr.body.id}/check-ins`,
      )
      .set(auth(adminToken))
      .send({ numericValue: 5 })
      .expect(201);
    const concurrent = await Promise.all([
      request(app.getHttpServer())
        .post(`/goals/${raceGoal.body.id}/completion-requests`)
        .set(auth(adminToken))
        .send({}),
      request(app.getHttpServer())
        .post(`/goals/${raceGoal.body.id}/completion-requests`)
        .set(auth(pmToken))
        .send({}),
    ]);
    const statuses = concurrent.map((r) => r.status).sort();
    expect(statuses).toContain(201);
    expect(statuses).toContain(409);

    // cycle close requires no ACTIVE/DRAFT
    await request(app.getHttpServer())
      .post(`/goals/cycles/${cycleId}/close`)
      .set(auth(adminToken))
      .expect(400);

    // cancel remaining ACTIVE race goal and draft
    const pendingRace = await prisma.goalCompletionRequest.findFirst({
      where: { goalId: raceGoal.body.id, status: 'PENDING' },
    });
    if (pendingRace) {
      // Rejector must differ from requester (self-review denied for approve/reject).
      const adminUser = await prisma.user.findFirstOrThrow({
        where: { email: `gc-admin-${suffix}@example.com` },
        select: { id: true },
      });
      const rejectToken =
        pendingRace.requestedByUserId === adminUser.id ? pmToken : adminToken;
      await request(app.getHttpServer())
        .post(`/goals/completion-requests/${pendingRace.id}/reject`)
        .set(auth(rejectToken))
        .send({ reviewComment: 'Cancel race' })
        .expect(201);
    }
    await request(app.getHttpServer())
      .post(`/goals/${raceGoal.body.id}/cancel`)
      .set(auth(adminToken))
      .expect(201);
    await request(app.getHttpServer())
      .post(`/goals/${draft.body.id}/cancel`)
      .set(auth(adminToken))
      .expect(201);

    // cancel any other ACTIVE/DRAFT in cycle
    const leftovers = await prisma.goal.findMany({
      where: {
        cycleId,
        status: { in: ['ACTIVE', 'DRAFT'] },
      },
    });
    for (const g of leftovers) {
      const pend = await prisma.goalCompletionRequest.findFirst({
        where: { goalId: g.id, status: 'PENDING' },
      });
      if (pend) {
        await request(app.getHttpServer())
          .post(`/goals/completion-requests/${pend.id}/reject`)
          .set(auth(pmToken))
          .send({ reviewComment: 'cleanup' })
          .expect(201);
      }
      await request(app.getHttpServer())
        .post(`/goals/${g.id}/cancel`)
        .set(auth(adminToken))
        .expect(201);
    }

    await request(app.getHttpServer())
      .post(`/goals/cycles/${cycleId}/close`)
      .set(auth(adminToken))
      .expect(201);

    // audit without comments
    const audits = await prisma.auditLog.findMany({
      where: {
        companyId: companyAId,
        action: {
          in: [
            GOALS_AUDIT.GOAL_COMPLETION_REQUESTED,
            GOALS_AUDIT.GOAL_COMPLETION_REJECTED,
            GOALS_AUDIT.GOAL_COMPLETED,
            GOALS_AUDIT.GOAL_RESULT_CREATED,
          ],
        },
      },
      take: 20,
    });
    expect(audits.length).toBeGreaterThan(0);
    for (const a of audits) {
      const meta = a.metadata as Record<string, unknown>;
      expect(meta.requestComment).toBeUndefined();
      expect(meta.reviewComment).toBeUndefined();
    }

    expect(adminUserId).toBeTruthy();
    expect(employeeBId).toBeTruthy();
    expect(JSON.stringify(approved.body).toLowerCase()).not.toContain(
      'ranking',
    );
  });
});
