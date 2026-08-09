/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
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

describe('Goals progress (09B)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let hasher: PasswordHashingService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const password = `GoalProg-${suffix}!`;

  let companyAId = '';
  let companyBId = '';
  let areaAId = '';
  let areaBId = '';
  let positionAId = '';
  let adminToken = '';
  let adminBToken = '';
  let perfManagerToken = '';
  let leaderToken = '';
  let collabToken = '';
  let collabBToken = '';
  let recruiterToken = '';
  let employeeAId = '';
  let employeeBId = '';
  let leaderEmployeeId = '';
  let cycleId = '';

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
        name: `GoalProg A ${suffix}`,
        slug: `goalprog-a-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    const companyB = await prisma.company.create({
      data: {
        name: `GoalProg B ${suffix}`,
        slug: `goalprog-b-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    companyAId = companyA.id;
    companyBId = companyB.id;

    const areaA = await prisma.area.create({
      data: { companyId: companyAId, name: `GPA ${suffix}` },
    });
    const areaB = await prisma.area.create({
      data: { companyId: companyAId, name: `GPB ${suffix}` },
    });
    areaAId = areaA.id;
    areaBId = areaB.id;
    const jl = await prisma.jobLevel.create({
      data: {
        companyId: companyAId,
        name: `GP JL ${suffix}`,
        rank: 8000 + Math.floor(Math.random() * 400),
      },
    });
    const position = await prisma.position.create({
      data: {
        companyId: companyAId,
        areaId: areaAId,
        jobLevelId: jl.id,
        name: `GP Pos ${suffix}`,
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
      LEADER: ['goals.cycle.read', 'goals.goal.read'],
      COLLABORATOR: [
        'goals.cycle.read',
        'goals.goal.read',
        'goals.progress.update',
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
    const collabBUser = await createUser(
      `gp-collab-b-${suffix}@example.com`,
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
    const empB = await prisma.employee.create({
      data: {
        companyId: companyAId,
        firstName: 'Bob',
        lastName: 'GP',
        email: `gp-bob-${suffix}@example.com`,
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

    adminToken = await login(`gp-admin-${suffix}@example.com`);
    perfManagerToken = await login(`gp-pm-${suffix}@example.com`);
    leaderToken = await login(`gp-leader-${suffix}@example.com`);
    collabToken = await login(`gp-collab-${suffix}@example.com`);
    collabBToken = await login(`gp-collab-b-${suffix}@example.com`);
    adminBToken = await login(`gp-admin-b-${suffix}@example.com`);
    recruiterToken = await login(`gp-recruiter-${suffix}@example.com`);

    const cycleRes = await request(app.getHttpServer())
      .post('/goals/cycles')
      .set(auth(adminToken))
      .send({
        name: `Cycle ${suffix}`,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      })
      .expect(201);
    cycleId = (cycleRes.body as { id: string }).id;
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

  it('check-ins, progress, team, RBAC and append-only semantics', async () => {
    // INDIVIDUAL NUMBER increase
    const indiv = await request(app.getHttpServer())
      .post('/goals')
      .set(auth(adminToken))
      .send({
        cycleId,
        title: 'Completar certificación',
        type: 'INDIVIDUAL',
      })
      .expect(201);
    const indivId = (indiv.body as { id: string }).id;
    await request(app.getHttpServer())
      .post(`/goals/${indivId}/assignments`)
      .set(auth(adminToken))
      .send({ employeeId: employeeAId })
      .expect(201);
    const krNum = await request(app.getHttpServer())
      .post(`/goals/${indivId}/key-results`)
      .set(auth(adminToken))
      .send({
        title: 'Módulos',
        metricType: 'NUMBER',
        direction: 'INCREASE',
        startValue: 0,
        targetValue: 10,
      })
      .expect(201);
    const krNumId = (krNum.body as { id: string }).id;
    await activateGoal(indivId);

    // Draft goal cannot check-in
    const draft = await request(app.getHttpServer())
      .post('/goals')
      .set(auth(adminToken))
      .send({ cycleId, title: 'Draft', type: 'COMPANY' })
      .expect(201);
    const draftId = (draft.body as { id: string }).id;
    const draftKr = await request(app.getHttpServer())
      .post(`/goals/${draftId}/key-results`)
      .set(auth(adminToken))
      .send({
        title: 'x',
        metricType: 'NUMBER',
        direction: 'INCREASE',
        startValue: 0,
        targetValue: 1,
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/goals/${draftId}/key-results/${(draftKr.body as { id: string }).id}/check-ins`,
      )
      .set(auth(adminToken))
      .send({ numericValue: 1 })
      .expect(400);

    // companyId in body rejected by ValidationPipe (forbidNonWhitelisted)
    await request(app.getHttpServer())
      .post(`/goals/${indivId}/key-results/${krNumId}/check-ins`)
      .set(auth(collabToken))
      .send({ numericValue: 2, companyId: companyBId })
      .expect(400);

    // Collaborator responsible can check-in
    const c1 = await request(app.getHttpServer())
      .post(`/goals/${indivId}/key-results/${krNumId}/check-ins`)
      .set(auth(collabToken))
      .send({
        numericValue: 2,
        comment: '  primer avance  ',
        evidenceReference: 'JIRA-123',
      })
      .expect(201);
    expect(c1.body.checkIn.sequence).toBe(1);
    expect(c1.body.checkIn.comment).toBe('primer avance');
    expect(c1.body.checkIn.evidenceReference).toBe('JIRA-123');
    expect(c1.body.keyResultProgress.progressPercentage).toBe(20);

    const c2 = await request(app.getHttpServer())
      .post(`/goals/${indivId}/key-results/${krNumId}/check-ins`)
      .set(auth(collabToken))
      .send({ numericValue: 5, comment: '' })
      .expect(201);
    expect(c2.body.checkIn.sequence).toBe(2);
    expect(c2.body.checkIn.comment).toBeNull();
    expect(c2.body.keyResultProgress.progressPercentage).toBe(50);

    await request(app.getHttpServer())
      .post(`/goals/${indivId}/key-results/${krNumId}/check-ins`)
      .set(auth(collabToken))
      .send({ numericValue: 8 })
      .expect(201);

    const hist = await request(app.getHttpServer())
      .get(`/goals/${indivId}/key-results/${krNumId}/check-ins`)
      .set(auth(collabToken))
      .query({ page: 1, limit: 10 })
      .expect(200);
    expect(
      hist.body.items.map((i: { sequence: number }) => i.sequence),
    ).toEqual([3, 2, 1]);
    expect(hist.body.total).toBe(3);

    const page2 = await request(app.getHttpServer())
      .get(`/goals/${indivId}/key-results/${krNumId}/check-ins`)
      .set(auth(collabToken))
      .query({ page: 2, limit: 2 })
      .expect(200);
    expect(page2.body.items).toHaveLength(1);
    expect(page2.body.items[0].sequence).toBe(1);

    const progress = await request(app.getHttpServer())
      .get(`/goals/${indivId}/progress`)
      .set(auth(collabToken))
      .expect(200);
    expect(progress.body.progressPercentage).toBe(80);
    expect(progress.body.keyResults[0].currentNumericValue).toBe('8');
    expect(JSON.stringify(progress.body).toLowerCase()).not.toContain('score');

    // overshoot clamp
    await request(app.getHttpServer())
      .post(`/goals/${indivId}/key-results/${krNumId}/check-ins`)
      .set(auth(collabToken))
      .send({ numericValue: 15 })
      .expect(201);
    const over = await request(app.getHttpServer())
      .get(`/goals/${indivId}/progress`)
      .set(auth(collabToken))
      .expect(200);
    expect(over.body.progressPercentage).toBe(100);
    expect(over.body.keyResults[0].currentNumericValue).toBe('15');

    // regression
    await request(app.getHttpServer())
      .post(`/goals/${indivId}/key-results/${krNumId}/check-ins`)
      .set(auth(collabToken))
      .send({ numericValue: 4 })
      .expect(201);
    const reg = await request(app.getHttpServer())
      .get(`/goals/${indivId}/progress`)
      .set(auth(collabToken))
      .expect(200);
    expect(reg.body.progressPercentage).toBe(40);

    // non-responsible collaborator cannot update
    await request(app.getHttpServer())
      .post(`/goals/${indivId}/key-results/${krNumId}/check-ins`)
      .set(auth(collabBToken))
      .send({ numericValue: 1 })
      .expect(403);

    // leader cannot update subordinate by default
    await request(app.getHttpServer())
      .post(`/goals/${indivId}/key-results/${krNumId}/check-ins`)
      .set(auth(leaderToken))
      .send({ numericValue: 1 })
      .expect(403);

    // recruiter forbidden
    await request(app.getHttpServer())
      .post(`/goals/${indivId}/key-results/${krNumId}/check-ins`)
      .set(auth(recruiterToken))
      .send({ numericValue: 1 })
      .expect(403);

    // admin + PM can update
    await request(app.getHttpServer())
      .post(`/goals/${indivId}/key-results/${krNumId}/check-ins`)
      .set(auth(adminToken))
      .send({ numericValue: 6 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/goals/${indivId}/key-results/${krNumId}/check-ins`)
      .set(auth(perfManagerToken))
      .send({ numericValue: 7 })
      .expect(201);

    // no PATCH / DELETE
    const latestId = (
      await request(app.getHttpServer())
        .get(`/goals/${indivId}/key-results/${krNumId}/check-ins`)
        .set(auth(adminToken))
        .expect(200)
    ).body.items[0].id as string;
    await request(app.getHttpServer())
      .patch(`/goals/${indivId}/key-results/${krNumId}/check-ins/${latestId}`)
      .set(auth(adminToken))
      .send({ numericValue: 99 })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/goals/${indivId}/key-results/${krNumId}/check-ins/${latestId}`)
      .set(auth(adminToken))
      .expect(404);

    // AREA decrease + non-responsible area employee
    const areaGoal = await request(app.getHttpServer())
      .post('/goals')
      .set(auth(adminToken))
      .send({
        cycleId,
        title: 'Reducir tiempo de respuesta',
        type: 'AREA',
        areaId: areaAId,
      })
      .expect(201);
    const areaGoalId = (areaGoal.body as { id: string }).id;
    await request(app.getHttpServer())
      .post(`/goals/${areaGoalId}/assignments`)
      .set(auth(adminToken))
      .send({ employeeId: employeeAId })
      .expect(201);
    const krDec = await request(app.getHttpServer())
      .post(`/goals/${areaGoalId}/key-results`)
      .set(auth(adminToken))
      .send({
        title: 'SLA',
        metricType: 'NUMBER',
        direction: 'DECREASE',
        startValue: 10,
        targetValue: 2,
      })
      .expect(201);
    const krDecId = (krDec.body as { id: string }).id;
    await activateGoal(areaGoalId);

    // Area employee (leader is in areaA) sees in mine but cannot update without assignment
    const leaderMine = await request(app.getHttpServer())
      .get('/goals/mine')
      .set(auth(leaderToken))
      .expect(200);
    expect(
      leaderMine.body.items.some((g: { id: string }) => g.id === areaGoalId),
    ).toBe(true);
    await request(app.getHttpServer())
      .post(`/goals/${areaGoalId}/key-results/${krDecId}/check-ins`)
      .set(auth(leaderToken))
      .send({ numericValue: 6 })
      .expect(403);

    const dec = await request(app.getHttpServer())
      .post(`/goals/${areaGoalId}/key-results/${krDecId}/check-ins`)
      .set(auth(collabToken))
      .send({ numericValue: 6 })
      .expect(201);
    expect(dec.body.keyResultProgress.progressPercentage).toBe(50);

    // COMPANY + BOOLEAN + PERCENTAGE + CURRENCY on weighted goal
    const companyGoal = await request(app.getHttpServer())
      .post('/goals')
      .set(auth(adminToken))
      .send({
        cycleId,
        title: 'Objetivo compañía',
        type: 'COMPANY',
      })
      .expect(201);
    const companyGoalId = (companyGoal.body as { id: string }).id;
    await request(app.getHttpServer())
      .post(`/goals/${companyGoalId}/assignments`)
      .set(auth(adminToken))
      .send({ employeeId: employeeAId })
      .expect(201);
    const krPct = await request(app.getHttpServer())
      .post(`/goals/${companyGoalId}/key-results`)
      .set(auth(adminToken))
      .send({
        title: 'Cobertura',
        metricType: 'PERCENTAGE',
        direction: 'INCREASE',
        startValue: 0,
        targetValue: 100,
        weight: 40,
      })
      .expect(201);
    const krCur = await request(app.getHttpServer())
      .post(`/goals/${companyGoalId}/key-results`)
      .set(auth(adminToken))
      .send({
        title: 'Ingresos',
        metricType: 'CURRENCY',
        direction: 'INCREASE',
        startValue: 0,
        targetValue: 20000000,
        currencyCode: 'COP',
        weight: 40,
      })
      .expect(201);
    const krBool = await request(app.getHttpServer())
      .post(`/goals/${companyGoalId}/key-results`)
      .set(auth(adminToken))
      .send({
        title: 'Publicar política',
        metricType: 'BOOLEAN',
        targetBoolean: true,
        weight: 20,
      })
      .expect(201);
    const krPctId = (krPct.body as { id: string }).id;
    const krCurId = (krCur.body as { id: string }).id;
    const krBoolId = (krBool.body as { id: string }).id;
    await activateGoal(companyGoalId);

    // type consistency
    await request(app.getHttpServer())
      .post(`/goals/${companyGoalId}/key-results/${krBoolId}/check-ins`)
      .set(auth(collabToken))
      .send({ numericValue: 1 })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/goals/${companyGoalId}/key-results/${krPctId}/check-ins`)
      .set(auth(collabToken))
      .send({ booleanValue: true })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/goals/${companyGoalId}/key-results/${krPctId}/check-ins`)
      .set(auth(collabToken))
      .send({ numericValue: 50 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/goals/${companyGoalId}/key-results/${krCurId}/check-ins`)
      .set(auth(collabToken))
      .send({ numericValue: 10000000 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/goals/${companyGoalId}/key-results/${krBoolId}/check-ins`)
      .set(auth(collabToken))
      .send({ booleanValue: false })
      .expect(201);
    let gp = await request(app.getHttpServer())
      .get(`/goals/${companyGoalId}/progress`)
      .set(auth(collabToken))
      .expect(200);
    // 50*0.4 + 50*0.4 + 0*0.2 = 40
    expect(gp.body.progressPercentage).toBe(40);

    await request(app.getHttpServer())
      .post(`/goals/${companyGoalId}/key-results/${krBoolId}/check-ins`)
      .set(auth(collabToken))
      .send({ booleanValue: true })
      .expect(201);
    gp = await request(app.getHttpServer())
      .get(`/goals/${companyGoalId}/progress`)
      .set(auth(collabToken))
      .expect(200);
    // 50*0.4 + 50*0.4 + 100*0.2 = 60
    expect(gp.body.progressPercentage).toBe(60);

    // COMPANY non-responsible sees but cannot update
    const bobMine = await request(app.getHttpServer())
      .get('/goals/mine')
      .set(auth(collabBToken))
      .expect(200);
    expect(
      bobMine.body.items.some((g: { id: string }) => g.id === companyGoalId),
    ).toBe(true);
    expect(
      bobMine.body.items.find((g: { id: string }) => g.id === companyGoalId)
        ?.canCheckIn,
    ).toBe(false);
    await request(app.getHttpServer())
      .post(`/goals/${companyGoalId}/key-results/${krBoolId}/check-ins`)
      .set(auth(collabBToken))
      .send({ booleanValue: false })
      .expect(403);

    // mine progress enrichment + no DRAFT
    const mine = await request(app.getHttpServer())
      .get('/goals/mine')
      .set(auth(collabToken))
      .expect(200);
    expect(
      mine.body.items.every((g: { status: string }) => g.status === 'ACTIVE'),
    ).toBe(true);
    expect(
      mine.body.items.find((g: { id: string }) => g.id === indivId)?.progress,
    ).toBeDefined();

    // team DIRECT only
    const team = await request(app.getHttpServer())
      .get('/goals/team')
      .set(auth(leaderToken))
      .expect(200);
    const teamEmpIds = team.body.employees.map(
      (e: { employee: { id: string } }) => e.employee.id,
    );
    expect(teamEmpIds).toContain(employeeAId);
    expect(teamEmpIds).not.toContain(employeeBId);
    const anaGoals = team.body.employees.find(
      (e: { employee: { id: string } }) => e.employee.id === employeeAId,
    ).goals;
    expect(anaGoals.some((g: { id: string }) => g.id === indivId)).toBe(true);

    // leader can read goal detail of report
    await request(app.getHttpServer())
      .get(`/goals/${indivId}`)
      .set(auth(leaderToken))
      .expect(200);

    // cross-tenant
    await request(app.getHttpServer())
      .get(`/goals/${indivId}/progress`)
      .set(auth(adminBToken, companyBId))
      .expect(404);
    await request(app.getHttpServer())
      .post(`/goals/${indivId}/key-results/${krNumId}/check-ins`)
      .set(auth(adminBToken, companyBId))
      .send({ numericValue: 1 })
      .expect(404);

    // KR / Goal mismatch
    await request(app.getHttpServer())
      .post(`/goals/${indivId}/key-results/${krBoolId}/check-ins`)
      .set(auth(adminToken))
      .send({ booleanValue: true })
      .expect(404);

    // CANCELLED goal cannot check-in
    await request(app.getHttpServer())
      .post(`/goals/${indivId}/cancel`)
      .set(auth(adminToken))
      .expect(201);
    await request(app.getHttpServer())
      .post(`/goals/${indivId}/key-results/${krNumId}/check-ins`)
      .set(auth(adminToken))
      .send({ numericValue: 9 })
      .expect(400);

    // audit without comment/evidence
    const audits = await prisma.auditLog.findMany({
      where: {
        companyId: companyAId,
        action: GOALS_AUDIT.GOAL_CHECK_IN_CREATED,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    expect(audits.length).toBeGreaterThan(0);
    for (const a of audits) {
      const meta = a.metadata as Record<string, unknown>;
      expect(meta.checkInId).toBeDefined();
      expect(meta.sequence).toBeDefined();
      expect(meta.comment).toBeUndefined();
      expect(meta.evidenceReference).toBeUndefined();
    }

    // concurrent check-ins on AREA KR (still ACTIVE)
    const results = await Promise.all([
      request(app.getHttpServer())
        .post(`/goals/${areaGoalId}/key-results/${krDecId}/check-ins`)
        .set(auth(adminToken))
        .send({ numericValue: 5 }),
      request(app.getHttpServer())
        .post(`/goals/${areaGoalId}/key-results/${krDecId}/check-ins`)
        .set(auth(perfManagerToken))
        .send({ numericValue: 4 }),
    ]);
    expect(results.every((r) => r.status === 201)).toBe(true);
    const sequences = results
      .map((r) => r.body.checkIn.sequence as number)
      .sort((a, b) => a - b);
    expect(new Set(sequences).size).toBe(2);

    // CLOSED cycle blocks check-in (force cycle CLOSED while goal stays ACTIVE)
    await prisma.goalCycle.update({
      where: { id: cycleId },
      data: { status: 'CLOSED' },
    });
    await request(app.getHttpServer())
      .post(`/goals/${areaGoalId}/key-results/${krDecId}/check-ins`)
      .set(auth(adminToken))
      .send({ numericValue: 3 })
      .expect(400);
  });
});
