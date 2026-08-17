import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  CompanyStatus,
  EmployeeStatus,
  MembershipStatus,
  PrismaClient,
  RoleScope,
  UserStatus,
} from '@prisma/client';
import { join } from 'node:path';
import { loadOptionalEnvFile } from './load-env';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PasswordHashingService } from '../src/auth/password-hashing.service';
import { GOALS_AUDIT } from '../src/goals/goals.constants';

loadOptionalEnvFile(join(__dirname, '../.env'));

describe('Goals core (09A)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let hasher: PasswordHashingService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const password = `GoalPass-${suffix}!`;

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
  let recruiterToken = '';
  let employeeAId = '';
  let employeeOtherAreaId = '';

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
        name: `Goal A ${suffix}`,
        slug: `goal-a-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    const companyB = await prisma.company.create({
      data: {
        name: `Goal B ${suffix}`,
        slug: `goal-b-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    companyAId = companyA.id;
    companyBId = companyB.id;

    const areaA = await prisma.area.create({
      data: { companyId: companyAId, name: `Goal Area A ${suffix}` },
    });
    const areaB = await prisma.area.create({
      data: { companyId: companyAId, name: `Goal Area B ${suffix}` },
    });
    areaAId = areaA.id;
    areaBId = areaB.id;
    const jl = await prisma.jobLevel.create({
      data: {
        companyId: companyAId,
        name: `Goal JL ${suffix}`,
        rank: 7000 + Math.floor(Math.random() * 400),
      },
    });
    const position = await prisma.position.create({
      data: {
        companyId: companyAId,
        areaId: areaAId,
        jobLevelId: jl.id,
        name: `Goal Pos ${suffix}`,
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
      COLLABORATOR: ['goals.cycle.read', 'goals.goal.read'],
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
          firstName: 'Goal',
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
      `goal-admin-${suffix}@example.com`,
      'CLIENT_ADMIN',
      companyAId,
    );
    await createUser(
      `goal-pm-${suffix}@example.com`,
      'PERFORMANCE_MANAGER',
      companyAId,
    );
    const leaderUser = await createUser(
      `goal-leader-${suffix}@example.com`,
      'LEADER',
      companyAId,
    );
    const collabUser = await createUser(
      `goal-collab-${suffix}@example.com`,
      'COLLABORATOR',
      companyAId,
    );
    await createUser(
      `goal-admin-b-${suffix}@example.com`,
      'CLIENT_ADMIN',
      companyBId,
    );
    await createUser(
      `goal-recruiter-${suffix}@example.com`,
      'RECRUITER',
      companyAId,
    );

    const empA = await prisma.employee.create({
      data: {
        companyId: companyAId,
        firstName: 'Ana',
        lastName: 'Goal',
        email: `goal-ana-${suffix}@example.com`,
        areaId: areaAId,
        positionId: positionAId,
        status: EmployeeStatus.ACTIVE,
        userId: collabUser.id,
      },
    });
    const empOther = await prisma.employee.create({
      data: {
        companyId: companyAId,
        firstName: 'Other',
        lastName: 'Area',
        email: `goal-other-${suffix}@example.com`,
        areaId: areaBId,
        positionId: positionAId,
        status: EmployeeStatus.ACTIVE,
        userId: leaderUser.id,
      },
    });
    employeeAId = empA.id;
    employeeOtherAreaId = empOther.id;

    adminToken = await login(`goal-admin-${suffix}@example.com`);
    perfManagerToken = await login(`goal-pm-${suffix}@example.com`);
    leaderToken = await login(`goal-leader-${suffix}@example.com`);
    collabToken = await login(`goal-collab-${suffix}@example.com`);
    adminBToken = await login(`goal-admin-b-${suffix}@example.com`);
    recruiterToken = await login(`goal-recruiter-${suffix}@example.com`);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const createCycle = (name: string, token = adminToken) =>
    request(app.getHttpServer()).post('/goals/cycles').set(auth(token)).send({
      name,
      startDate: '2026-10-01',
      endDate: '2026-12-31',
    });

  it('manages goal cycles, goals, KRs, assignments, mine and RBAC', async () => {
    await request(app.getHttpServer())
      .post('/goals/cycles')
      .set(auth(adminToken))
      .send({
        name: `Bad ${suffix}`,
        startDate: '2026-12-31',
        endDate: '2026-10-01',
      })
      .expect(400);

    const cycleRes = await createCycle(`Q4 ${suffix}`).expect(201);
    const cycleId = (cycleRes.body as { id: string }).id;
    expect(cycleRes.body).toMatchObject({ status: 'DRAFT' });

    await request(app.getHttpServer())
      .patch(`/goals/cycles/${cycleId}`)
      .set(auth(adminToken))
      .send({ description: 'Periodo Q4' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/goals/cycles/${cycleId}/activate`)
      .set(auth(adminToken))
      .expect(201);

    await request(app.getHttpServer())
      .post(`/goals/cycles/${cycleId}/activate`)
      .set(auth(adminToken))
      .expect(409);

    await request(app.getHttpServer())
      .get(`/goals/cycles/${cycleId}`)
      .set(auth(adminBToken, companyBId))
      .expect(404);

    const companyGoal = await request(app.getHttpServer())
      .post('/goals')
      .set(auth(adminToken))
      .send({
        cycleId,
        title: 'Mejorar satisfacción',
        type: 'COMPANY',
      })
      .expect(201);
    const companyGoalId = (companyGoal.body as { id: string }).id;

    const areaGoal = await request(app.getHttpServer())
      .post('/goals')
      .set(auth(adminToken))
      .send({
        cycleId,
        title: 'Reducir tiempo contratación',
        type: 'AREA',
        areaId: areaAId,
      })
      .expect(201);
    const areaGoalId = (areaGoal.body as { id: string }).id;

    await request(app.getHttpServer())
      .post('/goals')
      .set(auth(adminToken))
      .send({
        cycleId,
        title: 'Bad area',
        type: 'AREA',
        areaId: crypto.randomUUID(),
      })
      .expect(404);

    const individual = await request(app.getHttpServer())
      .post('/goals')
      .set(auth(adminToken))
      .send({
        cycleId,
        title: 'Completar certificación',
        type: 'INDIVIDUAL',
      })
      .expect(201);
    const individualId = (individual.body as { id: string }).id;

    await request(app.getHttpServer())
      .post(`/goals/${companyGoalId}/key-results`)
      .set(auth(adminToken))
      .send({
        title: 'NPS',
        metricType: 'NUMBER',
        direction: 'INCREASE',
        startValue: 50,
        targetValue: 70,
        unit: 'puntos',
        weight: 100,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/goals/${areaGoalId}/key-results`)
      .set(auth(adminToken))
      .send({
        title: 'Tiempo medio',
        metricType: 'PERCENTAGE',
        direction: 'DECREASE',
        startValue: 10,
        targetValue: 2,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/goals/${individualId}/key-results`)
      .set(auth(adminToken))
      .send({
        title: 'Inversión',
        metricType: 'CURRENCY',
        direction: 'INCREASE',
        targetValue: 1000,
        currencyCode: 'USD',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/goals/${individualId}/key-results`)
      .set(auth(adminToken))
      .send({
        title: 'Política',
        metricType: 'BOOLEAN',
        targetBoolean: true,
        order: 1,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/goals/${individualId}/key-results`)
      .set(auth(adminToken))
      .send({
        title: 'Bad',
        metricType: 'NUMBER',
        targetValue: 1,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/goals/${individualId}/activate`)
      .set(auth(adminToken))
      .expect(400);

    await request(app.getHttpServer())
      .post(`/goals/${individualId}/assignments`)
      .set(auth(adminToken))
      .send({ employeeId: employeeAId })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/goals/${individualId}/assignments`)
      .set(auth(adminToken))
      .send({ employeeId: employeeAId })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/goals/${individualId}/assignments`)
      .set(auth(adminToken))
      .send({ employeeId: crypto.randomUUID() })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/goals/${companyGoalId}/activate`)
      .set(auth(adminToken))
      .expect(201);
    await request(app.getHttpServer())
      .post(`/goals/${areaGoalId}/activate`)
      .set(auth(adminToken))
      .expect(201);
    await request(app.getHttpServer())
      .post(`/goals/${individualId}/activate`)
      .set(auth(adminToken))
      .expect(201);

    await request(app.getHttpServer())
      .post(`/goals/${individualId}/key-results`)
      .set(auth(adminToken))
      .send({
        title: 'Late',
        metricType: 'BOOLEAN',
        targetBoolean: true,
      })
      .expect(400);

    await request(app.getHttpServer())
      .delete(
        `/goals/${individualId}/key-results/${
          (
            await prisma.goalKeyResult.findFirstOrThrow({
              where: { goalId: individualId },
            })
          ).id
        }`,
      )
      .set(auth(adminToken))
      .expect(400);

    const list = await request(app.getHttpServer())
      .get(
        `/goals?cycleId=${cycleId}&status=ACTIVE&type=AREA&areaId=${areaAId}`,
      )
      .set(auth(adminToken))
      .expect(200);
    expect((list.body as { total: number }).total).toBe(1);

    const search = await request(app.getHttpServer())
      .get(`/goals?search=certificación&page=1&limit=10`)
      .set(auth(adminToken))
      .expect(200);
    expect((search.body as { total: number }).total).toBeGreaterThanOrEqual(1);

    const mineCollab = await request(app.getHttpServer())
      .get('/goals/mine')
      .set(auth(collabToken))
      .expect(200);
    const mineIds = (
      mineCollab.body as { items: Array<{ id: string; type: string }> }
    ).items.map((i) => i.id);
    expect(mineIds).toEqual(
      expect.arrayContaining([companyGoalId, areaGoalId, individualId]),
    );

    const draftHidden = await request(app.getHttpServer())
      .post('/goals')
      .set(auth(adminToken))
      .send({
        cycleId,
        title: 'Draft oculto',
        type: 'COMPANY',
      })
      .expect(201);
    const draftId = (draftHidden.body as { id: string }).id;
    const mineAfterDraft = await request(app.getHttpServer())
      .get('/goals/mine')
      .set(auth(collabToken))
      .expect(200);
    expect(
      (mineAfterDraft.body as { items: Array<{ id: string }> }).items.some(
        (i) => i.id === draftId,
      ),
    ).toBe(false);

    const mineLeader = await request(app.getHttpServer())
      .get('/goals/mine')
      .set(auth(leaderToken))
      .expect(200);
    const leaderIds = (
      mineLeader.body as { items: Array<{ id: string }> }
    ).items.map((i) => i.id);
    expect(leaderIds).toContain(companyGoalId);
    expect(leaderIds).not.toContain(areaGoalId);
    expect(leaderIds).not.toContain(individualId);

    await request(app.getHttpServer())
      .get('/goals')
      .set(auth(leaderToken))
      .expect(403);
    await request(app.getHttpServer())
      .post('/goals')
      .set(auth(collabToken))
      .send({
        cycleId,
        title: 'No',
        type: 'COMPANY',
      })
      .expect(403);
    await request(app.getHttpServer())
      .get('/goals/cycles')
      .set(auth(recruiterToken))
      .expect(403);

    await request(app.getHttpServer())
      .post('/goals')
      .set(auth(perfManagerToken))
      .send({
        cycleId,
        title: 'PM goal',
        type: 'COMPANY',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/goals/${draftId}/cancel`)
      .set(auth(adminToken))
      .expect(201);

    const cancelledMine = await request(app.getHttpServer())
      .get('/goals/mine')
      .set(auth(collabToken))
      .expect(200);
    expect(
      (cancelledMine.body as { items: Array<{ id: string }> }).items.some(
        (i) => i.id === draftId,
      ),
    ).toBe(false);

    await request(app.getHttpServer())
      .post(`/goals/cycles/${cycleId}/close`)
      .set(auth(adminToken))
      .expect(400);

    const audit = await prisma.auditLog.findFirst({
      where: {
        companyId: companyAId,
        action: GOALS_AUDIT.GOAL_CYCLE_ACTIVATED,
        entityId: cycleId,
      },
    });
    expect(audit).toBeTruthy();

    void employeeOtherAreaId;
  });
});
