import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  CompanyStatus,
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
import { PERFORMANCE_AUDIT } from '../src/performance/performance.constants';

loadOptionalEnvFile(join(__dirname, '../.env'));

describe('Performance core (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let hasher: PasswordHashingService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const password = `PerfPass-${suffix}!`;

  let companyAId = '';
  let companyBId = '';
  let adminToken = '';
  let adminBToken = '';
  let leaderToken = '';
  let recruiterToken = '';
  let perfManagerToken = '';

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

  const createScaleWithLevels = async (
    token: string,
    companyId: string,
    name: string,
    levelCount = 5,
  ) => {
    const scaleRes = await request(app.getHttpServer())
      .post('/performance/scales')
      .set(auth(token, companyId))
      .send({ name })
      .expect(201);
    const scaleId = (scaleRes.body as { id: string }).id;
    const labels = [
      'Insuficiente',
      'En desarrollo',
      'Cumple',
      'Supera',
      'Sobresaliente',
    ];
    for (let i = 1; i <= levelCount; i += 1) {
      await request(app.getHttpServer())
        .post(`/performance/scales/${scaleId}/levels`)
        .set(auth(token, companyId))
        .send({
          value: i,
          label: labels[i - 1] ?? `Nivel ${i}`,
          order: i,
        })
        .expect(201);
    }
    return scaleId;
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
        name: `Perf A ${suffix}`,
        slug: `perf-a-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    const companyB = await prisma.company.create({
      data: {
        name: `Perf B ${suffix}`,
        slug: `perf-b-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    companyAId = companyA.id;
    companyBId = companyB.id;

    const permissions = [
      {
        code: 'performance.cycle.read',
        name: 'Read performance cycles',
        description: 'View cycles',
      },
      {
        code: 'performance.cycle.manage',
        name: 'Manage performance cycles',
        description: 'Manage cycles',
      },
      {
        code: 'performance.competency.read',
        name: 'Read competencies',
        description: 'View competencies',
      },
      {
        code: 'performance.competency.manage',
        name: 'Manage competencies',
        description: 'Manage competencies',
      },
      {
        code: 'performance.scale.read',
        name: 'Read scales',
        description: 'View scales',
      },
      {
        code: 'performance.scale.manage',
        name: 'Manage scales',
        description: 'Manage scales',
      },
    ] as const;

    const permissionIds = new Map<string, string>();
    for (const permission of permissions) {
      const saved = await prisma.permission.upsert({
        where: { code: permission.code },
        create: { ...permission },
        update: {
          name: permission.name,
          description: permission.description,
        },
      });
      permissionIds.set(permission.code, saved.id);
    }

    const allPerf = permissions.map((p) => p.code);
    const readPerf = [
      'performance.cycle.read',
      'performance.competency.read',
      'performance.scale.read',
    ];

    const permissionByRole: Record<string, string[]> = {
      CLIENT_ADMIN: [...allPerf],
      PERFORMANCE_MANAGER: [...allPerf],
      LEADER: [...readPerf],
      COLLABORATOR: [...readPerf],
    };

    for (const [roleCode, codes] of Object.entries(permissionByRole)) {
      const role = await prisma.role.findUniqueOrThrow({
        where: { scope_code: { scope: RoleScope.COMPANY, code: roleCode } },
      });
      for (const code of codes) {
        const permissionId = permissionIds.get(code)!;
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: role.id, permissionId },
          },
          create: { roleId: role.id, permissionId },
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
          firstName: 'Perf',
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
      `perf-admin-${suffix}@example.com`,
      'CLIENT_ADMIN',
      companyAId,
    );
    await createUser(
      `perf-manager-${suffix}@example.com`,
      'PERFORMANCE_MANAGER',
      companyAId,
    );
    await createUser(`perf-leader-${suffix}@example.com`, 'LEADER', companyAId);
    await createUser(
      `perf-recruiter-${suffix}@example.com`,
      'RECRUITER',
      companyAId,
    );
    await createUser(
      `perf-admin-b-${suffix}@example.com`,
      'CLIENT_ADMIN',
      companyBId,
    );

    adminToken = await login(`perf-admin-${suffix}@example.com`);
    perfManagerToken = await login(`perf-manager-${suffix}@example.com`);
    leaderToken = await login(`perf-leader-${suffix}@example.com`);
    recruiterToken = await login(`perf-recruiter-${suffix}@example.com`);
    adminBToken = await login(`perf-admin-b-${suffix}@example.com`);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('rejects invalid cycle dates', async () => {
    await request(app.getHttpServer())
      .post('/performance/cycles')
      .set(auth(adminToken))
      .send({
        name: `Bad dates ${suffix}`,
        startDate: '2026-12-31',
        endDate: '2026-01-01',
      })
      .expect(400);
  });

  it('creates competencies with tenant-scoped uniqueness', async () => {
    const created = await request(app.getHttpServer())
      .post('/performance/competencies')
      .set(auth(adminToken))
      .send({
        name: 'Liderazgo',
        code: 'LIDERAZGO',
        description: 'Capacidad de guiar equipos',
      })
      .expect(201);

    expect((created.body as { name: string }).name).toBe('Liderazgo');

    await request(app.getHttpServer())
      .post('/performance/competencies')
      .set(auth(adminToken))
      .send({ name: 'Liderazgo', code: 'LIDERAZGO2' })
      .expect(409);

    await request(app.getHttpServer())
      .post('/performance/competencies')
      .set(auth(adminBToken, companyBId))
      .send({ name: 'Liderazgo', code: 'LIDERAZGO' })
      .expect(201);

    const listB = await request(app.getHttpServer())
      .get('/performance/competencies')
      .set(auth(adminBToken, companyBId))
      .expect(200);
    expect((listB.body as { items: unknown[] }).items.length).toBeGreaterThan(
      0,
    );

    const listA = await request(app.getHttpServer())
      .get('/performance/competencies')
      .set(auth(adminToken))
      .query({ search: 'Liderazgo' })
      .expect(200);
    const itemsA = (listA.body as { items: { companyId: string }[] }).items;
    expect(itemsA.every((i) => i.companyId === companyAId)).toBe(true);
  });

  it('rejects duplicate competency codes with a clear Spanish message', async () => {
    await request(app.getHttpServer())
      .post('/performance/competencies')
      .set(auth(adminToken))
      .send({ name: `Comp code ${suffix}`, code: `DUP-CO-${suffix}` })
      .expect(201);

    const dup = await request(app.getHttpServer())
      .post('/performance/competencies')
      .set(auth(adminToken))
      .send({ name: `Comp code other ${suffix}`, code: `DUP-CO-${suffix}` })
      .expect(409);
    expect((dup.body as { message: string }).message).toBe(
      `Ya existe una competencia con el código DUP-CO-${suffix}.`,
    );

    await request(app.getHttpServer())
      .post('/performance/competencies')
      .set(auth(adminBToken, companyBId))
      .send({ name: `Comp code B ${suffix}`, code: `DUP-CO-${suffix}` })
      .expect(201);

    const keep = await request(app.getHttpServer())
      .post('/performance/competencies')
      .set(auth(adminToken))
      .send({ name: `Comp keep ${suffix}`, code: `KEEP-CO-${suffix}` })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/performance/competencies/${(keep.body as { id: string }).id}`)
      .set(auth(adminToken))
      .send({ code: `KEEP-CO-${suffix}` })
      .expect(200);

    const steal = await request(app.getHttpServer())
      .post('/performance/competencies')
      .set(auth(adminToken))
      .send({ name: `Comp steal ${suffix}`, code: `STEAL-CO-${suffix}` })
      .expect(201);
    const stealUpdate = await request(app.getHttpServer())
      .patch(`/performance/competencies/${(steal.body as { id: string }).id}`)
      .set(auth(adminToken))
      .send({ code: `KEEP-CO-${suffix}` })
      .expect(409);
    expect((stealUpdate.body as { message: string }).message).toBe(
      `Ya existe una competencia con el código KEEP-CO-${suffix}.`,
    );
  });

  it('assigns a competency to a job level without requiring code or scale', async () => {
    const level = await prisma.jobLevel.create({
      data: {
        companyId: companyAId,
        name: `Nivel competencia ${suffix}`,
        rank: 800000 + Math.floor(Math.random() * 100000),
      },
    });

    const created = await request(app.getHttpServer())
      .post('/performance/competencies')
      .set(auth(adminToken))
      .send({
        name: `Comp nivel ${suffix}`,
        jobLevelId: level.id,
      })
      .expect(201);

    const body = created.body as {
      code: string | null;
      defaultScaleId: string | null;
      jobLevels: Array<{ id: string; name: string }>;
    };
    expect(body.defaultScaleId).toBeNull();
    expect(body.code).toMatch(/^\d{3}$/);
    expect(body.jobLevels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: level.id, name: level.name }),
      ]),
    );

    const missingLevel = await request(app.getHttpServer())
      .post('/performance/competencies')
      .set(auth(adminToken))
      .send({
        name: `Comp nivel missing ${suffix}`,
        jobLevelId: '00000000-0000-4000-8000-000000000001',
      })
      .expect(404);
    expect((missingLevel.body as { message: string }).message).toBe(
      'Job level not found',
    );
  });

  it('rejects a quantitative scale when adding a competency to a cycle', async () => {
    const quantitative = await request(app.getHttpServer())
      .post('/performance/scales')
      .set(auth(adminToken))
      .send({
        name: `Escala cuantitativa ${suffix}`,
        kind: 'QUANTITATIVE',
      })
      .expect(201);
    const quantitativeId = (quantitative.body as { id: string; kind: string })
      .id;
    expect((quantitative.body as { kind: string }).kind).toBe('QUANTITATIVE');

    await request(app.getHttpServer())
      .post(`/performance/scales/${quantitativeId}/levels`)
      .set(auth(adminToken))
      .send({ value: 1, label: '10', order: 1 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/performance/scales/${quantitativeId}/levels`)
      .set(auth(adminToken))
      .send({ value: 2, label: '20', order: 2 })
      .expect(201);

    const competency = await request(app.getHttpServer())
      .post('/performance/competencies')
      .set(auth(adminToken))
      .send({ name: `Comp cuantitativa ${suffix}` })
      .expect(201);
    const competencyId = (competency.body as { id: string }).id;

    const cycle = await request(app.getHttpServer())
      .post('/performance/cycles')
      .set(auth(adminToken))
      .send({
        name: `Ciclo cuantitativa ${suffix}`,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      })
      .expect(201);
    const cycleId = (cycle.body as { id: string }).id;

    const rejected = await request(app.getHttpServer())
      .post(`/performance/cycles/${cycleId}/competencies`)
      .set(auth(adminToken))
      .send({ competencyId, scaleId: quantitativeId })
      .expect(400);
    expect((rejected.body as { message: string }).message).toBe(
      'Las competencias solo pueden calificarse con una escala cualitativa.',
    );
  });

  it('creates scales, levels, and rejects duplicates', async () => {
    const scaleId = await createScaleWithLevels(
      adminToken,
      companyAId,
      `Escala corporativa ${suffix}`,
      5,
    );

    await request(app.getHttpServer())
      .post(`/performance/scales/${scaleId}/levels`)
      .set(auth(adminToken))
      .send({ value: 1, label: 'Dup', order: 99 })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/performance/scales/${scaleId}/levels`)
      .set(auth(adminToken))
      .send({ value: 99, label: 'Dup order', order: 1 })
      .expect(409);

    const detail = await request(app.getHttpServer())
      .get(`/performance/scales/${scaleId}`)
      .set(auth(adminToken))
      .expect(200);
    expect((detail.body as { levels: unknown[] }).levels).toHaveLength(5);
  });

  it('configures cycle competencies with tenant isolation and activates', async () => {
    const names = [
      'Comunicación',
      'Trabajo en equipo',
      'Orientación a resultados',
    ];
    const competencyIds: string[] = [];
    for (const name of names) {
      const res = await request(app.getHttpServer())
        .post('/performance/competencies')
        .set(auth(adminToken))
        .send({ name: `${name} ${suffix}` })
        .expect(201);
      competencyIds.push((res.body as { id: string }).id);
    }
    const liderazgo = await request(app.getHttpServer())
      .get('/performance/competencies')
      .set(auth(adminToken))
      .query({ search: 'Liderazgo' })
      .expect(200);
    const liderazgoId = (
      liderazgo.body as { items: { id: string; name: string }[] }
    ).items.find((i) => i.name === 'Liderazgo')!.id;
    competencyIds.unshift(liderazgoId);

    const scaleId = await createScaleWithLevels(
      adminToken,
      companyAId,
      `Escala ciclo ${suffix}`,
      5,
    );

    const scaleB = await createScaleWithLevels(
      adminBToken,
      companyBId,
      `Escala B ${suffix}`,
      3,
    );
    const competencyB = await request(app.getHttpServer())
      .post('/performance/competencies')
      .set(auth(adminBToken, companyBId))
      .send({ name: `Comp B ${suffix}` })
      .expect(201);
    const competencyBId = (competencyB.body as { id: string }).id;

    const cycleRes = await request(app.getHttpServer())
      .post('/performance/cycles')
      .set(auth(adminToken))
      .send({
        name: `Evaluación de desempeño 2026 ${suffix}`,
        description: 'Ciclo anual',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        evaluationStartDate: '2026-11-01',
        evaluationEndDate: '2026-12-15',
      })
      .expect(201);
    const cycleId = (cycleRes.body as { id: string }).id;
    expect((cycleRes.body as { status: string }).status).toBe('DRAFT');

    await request(app.getHttpServer())
      .post(`/performance/cycles/${cycleId}/activate`)
      .set(auth(adminToken))
      .expect(400);

    for (let i = 0; i < competencyIds.length; i += 1) {
      await request(app.getHttpServer())
        .post(`/performance/cycles/${cycleId}/competencies`)
        .set(auth(adminToken))
        .send({
          competencyId: competencyIds[i],
          scaleId,
          weight: 25,
          order: i,
          required: true,
        })
        .expect(201);
    }

    await request(app.getHttpServer())
      .post(`/performance/cycles/${cycleId}/competencies`)
      .set(auth(adminToken))
      .send({ competencyId: competencyBId, scaleId })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/performance/cycles/${cycleId}/competencies`)
      .set(auth(adminToken))
      .send({ competencyId: competencyIds[0], scaleId: scaleB })
      .expect(404);

    await request(app.getHttpServer())
      .get(`/performance/cycles/${cycleId}`)
      .set(auth(adminBToken, companyBId))
      .expect(404);

    const thinScale = await request(app.getHttpServer())
      .post('/performance/scales')
      .set(auth(adminToken))
      .send({ name: `Thin ${suffix}` })
      .expect(201);
    const thinScaleId = (thinScale.body as { id: string }).id;
    await request(app.getHttpServer())
      .post(`/performance/scales/${thinScaleId}/levels`)
      .set(auth(adminToken))
      .send({ value: 1, label: 'Solo uno', order: 1 })
      .expect(201);

    const thinCycle = await request(app.getHttpServer())
      .post('/performance/cycles')
      .set(auth(adminToken))
      .send({
        name: `Thin cycle ${suffix}`,
        startDate: '2026-01-01',
        endDate: '2026-06-30',
      })
      .expect(201);
    const thinCycleId = (thinCycle.body as { id: string }).id;
    await request(app.getHttpServer())
      .post(`/performance/cycles/${thinCycleId}/competencies`)
      .set(auth(adminToken))
      .send({
        competencyId: competencyIds[0],
        scaleId: thinScaleId,
        weight: 100,
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/performance/cycles/${thinCycleId}/activate`)
      .set(auth(adminToken))
      .expect(400);

    const badWeightCycle = await request(app.getHttpServer())
      .post('/performance/cycles')
      .set(auth(adminToken))
      .send({
        name: `Bad weights ${suffix}`,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      })
      .expect(201);
    const badWeightCycleId = (badWeightCycle.body as { id: string }).id;
    await request(app.getHttpServer())
      .post(`/performance/cycles/${badWeightCycleId}/competencies`)
      .set(auth(adminToken))
      .send({ competencyId: competencyIds[0], scaleId, weight: 40 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/performance/cycles/${badWeightCycleId}/competencies`)
      .set(auth(adminToken))
      .send({ competencyId: competencyIds[1], scaleId, weight: 40 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/performance/cycles/${badWeightCycleId}/activate`)
      .set(auth(adminToken))
      .expect(400);

    const activated = await request(app.getHttpServer())
      .post(`/performance/cycles/${cycleId}/activate`)
      .set(auth(adminToken))
      .expect(201);
    expect((activated.body as { status: string }).status).toBe('ACTIVE');

    const concurrent = await Promise.all([
      request(app.getHttpServer())
        .post(`/performance/cycles/${cycleId}/activate`)
        .set(auth(adminToken)),
      request(app.getHttpServer())
        .post(`/performance/cycles/${cycleId}/activate`)
        .set(auth(perfManagerToken)),
    ]);
    expect(concurrent.every((r) => r.status === 400 || r.status === 409)).toBe(
      true,
    );

    await request(app.getHttpServer())
      .post(`/performance/cycles/${cycleId}/competencies`)
      .set(auth(adminToken))
      .send({ competencyId: competencyIds[1], scaleId, weight: 25 })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/performance/cycles/${cycleId}`)
      .set(auth(adminToken))
      .send({ name: 'No edit ACTIVE' })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/performance/cycles/${cycleId}/close`)
      .set(auth(adminToken))
      .expect(201);

    await request(app.getHttpServer())
      .post(`/performance/cycles/${cycleId}/cancel`)
      .set(auth(adminToken))
      .expect(400);

    const cancelable = await request(app.getHttpServer())
      .post('/performance/cycles')
      .set(auth(adminToken))
      .send({
        name: `Cancel me ${suffix}`,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/performance/cycles/${(cancelable.body as { id: string }).id}/cancel`,
      )
      .set(auth(adminToken))
      .expect(201);

    const audits = await prisma.auditLog.findMany({
      where: {
        companyId: companyAId,
        action: {
          in: [
            PERFORMANCE_AUDIT.PERFORMANCE_CYCLE_CREATED,
            PERFORMANCE_AUDIT.PERFORMANCE_CYCLE_ACTIVATED,
            PERFORMANCE_AUDIT.PERFORMANCE_CYCLE_CLOSED,
            PERFORMANCE_AUDIT.CYCLE_COMPETENCY_ADDED,
            PERFORMANCE_AUDIT.COMPETENCY_CREATED,
            PERFORMANCE_AUDIT.COMPETENCY_SCALE_CREATED,
          ],
        },
      },
    });
    expect(audits.length).toBeGreaterThan(0);
  });

  it('enforces RBAC', async () => {
    await request(app.getHttpServer())
      .get('/performance/cycles')
      .set(auth(leaderToken))
      .expect(200);

    await request(app.getHttpServer())
      .post('/performance/cycles')
      .set(auth(leaderToken))
      .send({
        name: `Leader blocked ${suffix}`,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      })
      .expect(403);

    await request(app.getHttpServer())
      .get('/performance/cycles')
      .set(auth(recruiterToken))
      .expect(403);

    await request(app.getHttpServer())
      .post('/performance/competencies')
      .set(auth(perfManagerToken))
      .send({ name: `PM Comp ${suffix}` })
      .expect(201);
  });
});
