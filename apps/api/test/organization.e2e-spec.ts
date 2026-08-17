import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  CompanyStatus,
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

loadOptionalEnvFile(join(__dirname, '../.env'));

type LoginBody = {
  accessToken: string;
  user: { id: string };
  companies: Array<{ id: string }>;
};

describe('Organization core (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let hasher: PasswordHashingService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  let companyAId = '';
  let companyBId = '';
  let adminAToken = '';
  let adminBToken = '';
  let adminAUserId = '';
  let readerToken = '';

  let areaAId = '';
  let areaBId = '';
  let positionAId = '';
  let jobLevelAId = '';
  let businessUnitAId = '';
  let employeeAId = '';
  let managerAId = '';
  let employeeBId = '';

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
        name: `Org A ${suffix}`,
        slug: `org-a-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    const companyB = await prisma.company.create({
      data: {
        name: `Org B ${suffix}`,
        slug: `org-b-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    companyAId = companyA.id;
    companyBId = companyB.id;

    const password = `OrgPass-${suffix}!`;
    const passwordHash = await hasher.hash(password);

    const adminA = await prisma.user.create({
      data: {
        email: `orga-admin-${suffix}@example.com`,
        passwordHash,
        firstName: 'Admin',
        lastName: 'A',
        status: UserStatus.ACTIVE,
      },
    });
    adminAUserId = adminA.id;
    const adminB = await prisma.user.create({
      data: {
        email: `orgb-admin-${suffix}@example.com`,
        passwordHash,
        firstName: 'Admin',
        lastName: 'B',
        status: UserStatus.ACTIVE,
      },
    });
    const reader = await prisma.user.create({
      data: {
        email: `orga-reader-${suffix}@example.com`,
        passwordHash,
        firstName: 'Reader',
        lastName: 'A',
        status: UserStatus.ACTIVE,
      },
    });

    const roleAdmin = await prisma.role.findUniqueOrThrow({
      where: {
        scope_code: { scope: RoleScope.COMPANY, code: 'CLIENT_ADMIN' },
      },
    });
    const roleCollab = await prisma.role.findUniqueOrThrow({
      where: {
        scope_code: { scope: RoleScope.COMPANY, code: 'COLLABORATOR' },
      },
    });

    for (const [userId, companyId, roleId] of [
      [adminA.id, companyA.id, roleAdmin.id],
      [adminB.id, companyB.id, roleAdmin.id],
      [reader.id, companyA.id, roleCollab.id],
    ] as const) {
      const membership = await prisma.companyMembership.create({
        data: {
          userId,
          companyId,
          status: MembershipStatus.ACTIVE,
        },
      });
      await prisma.membershipRole.create({
        data: { membershipId: membership.id, roleId },
      });
    }

    // Same user can also be member of company B for multi-company employee tests later
    const dualMembership = await prisma.companyMembership.create({
      data: {
        userId: adminA.id,
        companyId: companyB.id,
        status: MembershipStatus.ACTIVE,
      },
    });
    await prisma.membershipRole.create({
      data: { membershipId: dualMembership.id, roleId: roleAdmin.id },
    });

    const login = async (email: string): Promise<LoginBody> => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(201);
      return res.body as LoginBody;
    };

    adminAToken = (await login(`orga-admin-${suffix}@example.com`)).accessToken;
    adminBToken = (await login(`orgb-admin-${suffix}@example.com`)).accessToken;
    readerToken = (await login(`orga-reader-${suffix}@example.com`))
      .accessToken;

    const bu = await request(app.getHttpServer())
      .post('/organization/business-units')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .send({ name: `BU A ${suffix}`, code: `BUA-${suffix}` })
      .expect(201);
    businessUnitAId = (bu.body as { id: string }).id;

    const jl = await request(app.getHttpServer())
      .post('/organization/job-levels')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .send({ name: `Level A ${suffix}`, rank: 10 })
      .expect(201);
    jobLevelAId = (jl.body as { id: string }).id;

    const area = await request(app.getHttpServer())
      .post('/organization/areas')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .send({
        name: `Area A ${suffix}`,
        businessUnitId: businessUnitAId,
      })
      .expect(201);
    areaAId = (area.body as { id: string }).id;

    const pos = await request(app.getHttpServer())
      .post('/organization/positions')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .send({
        name: `Position A ${suffix}`,
        areaId: areaAId,
        jobLevelId: jobLevelAId,
        headcount: 2,
      })
      .expect(201);
    positionAId = (pos.body as { id: string }).id;

    const areaB = await request(app.getHttpServer())
      .post('/organization/areas')
      .set('Authorization', `Bearer ${adminBToken}`)
      .set('X-Company-Id', companyBId)
      .send({ name: `Area B ${suffix}` })
      .expect(201);
    areaBId = (areaB.body as { id: string }).id;

    const posB = await request(app.getHttpServer())
      .post('/organization/positions')
      .set('Authorization', `Bearer ${adminBToken}`)
      .set('X-Company-Id', companyBId)
      .send({
        name: `Position B ${suffix}`,
        areaId: areaBId,
      })
      .expect(201);

    const empA = await request(app.getHttpServer())
      .post('/organization/employees')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .send({
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: `ada-${suffix}@example.com`,
        areaId: areaAId,
        positionId: positionAId,
        businessUnitId: businessUnitAId,
        childrenCount: 0,
      })
      .expect(201);
    employeeAId = (empA.body as { id: string }).id;

    const mgr = await request(app.getHttpServer())
      .post('/organization/employees')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .send({
        firstName: 'Grace',
        lastName: 'Hopper',
        email: `grace-${suffix}@example.com`,
        areaId: areaAId,
        positionId: positionAId,
      })
      .expect(201);
    managerAId = (mgr.body as { id: string }).id;

    const empB = await request(app.getHttpServer())
      .post('/organization/employees')
      .set('Authorization', `Bearer ${adminBToken}`)
      .set('X-Company-Id', companyBId)
      .send({
        firstName: 'Alan',
        lastName: 'Turing',
        email: `alan-${suffix}@example.com`,
        areaId: areaBId,
        positionId: (posB.body as { id: string }).id,
      })
      .expect(201);
    employeeBId = (empB.body as { id: string }).id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('requires JWT and tenant context', async () => {
    await request(app.getHttpServer())
      .get('/organization/employees')
      .expect(401);

    await request(app.getHttpServer())
      .get('/organization/employees')
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(403);
  });

  it('enforces organization.read vs manage permissions', async () => {
    await request(app.getHttpServer())
      .get('/organization/areas')
      .set('Authorization', `Bearer ${readerToken}`)
      .set('X-Company-Id', companyAId)
      .expect(200);

    await request(app.getHttpServer())
      .post('/organization/areas')
      .set('Authorization', `Bearer ${readerToken}`)
      .set('X-Company-Id', companyAId)
      .send({ name: `Forbidden ${suffix}` })
      .expect(403);
  });

  it('isolates company A from company B entities', async () => {
    await request(app.getHttpServer())
      .get(`/organization/employees/${employeeBId}`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .expect(404);

    await request(app.getHttpServer())
      .post('/organization/positions')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .send({
        name: `Cross position ${suffix}`,
        areaId: areaBId,
      })
      .expect(404);

    await request(app.getHttpServer())
      .post('/organization/employees')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .send({
        firstName: 'Cross',
        lastName: 'Tenant',
        email: `cross-${suffix}@example.com`,
        areaId: areaBId,
        positionId: positionAId,
      })
      .expect(404);
  });

  it('rejects cross-tenant JobLevel / BusinessUnit / Position on employee', async () => {
    const jlB = await request(app.getHttpServer())
      .post('/organization/job-levels')
      .set('Authorization', `Bearer ${adminBToken}`)
      .set('X-Company-Id', companyBId)
      .send({ name: `Level B ${suffix}`, rank: 1 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/organization/positions')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .send({
        name: `Bad JL ${suffix}`,
        areaId: areaAId,
        jobLevelId: (jlB.body as { id: string }).id,
      })
      .expect(404);

    const buB = await request(app.getHttpServer())
      .post('/organization/business-units')
      .set('Authorization', `Bearer ${adminBToken}`)
      .set('X-Company-Id', companyBId)
      .send({ name: `BU B ${suffix}` })
      .expect(201);

    await request(app.getHttpServer())
      .post('/organization/employees')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .send({
        firstName: 'Bad',
        lastName: 'BU',
        email: `badbu-${suffix}@example.com`,
        areaId: areaAId,
        positionId: positionAId,
        businessUnitId: (buB.body as { id: string }).id,
      })
      .expect(404);
  });

  it('supports user membership rules for Employee.userId', async () => {
    const outsider = await prisma.user.create({
      data: {
        email: `outsider-${suffix}@example.com`,
        passwordHash: await hasher.hash('Outsider1!'),
        firstName: 'Out',
        lastName: 'Sider',
        status: UserStatus.ACTIVE,
      },
    });

    await request(app.getHttpServer())
      .post('/organization/employees')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .send({
        firstName: 'No',
        lastName: 'Membership',
        email: `nomem-${suffix}@example.com`,
        areaId: areaAId,
        positionId: positionAId,
        userId: outsider.id,
      })
      .expect(404);

    const linked = await request(app.getHttpServer())
      .post('/organization/employees')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .send({
        firstName: 'Linked',
        lastName: 'User',
        email: `linked-a-${suffix}@example.com`,
        areaId: areaAId,
        positionId: positionAId,
        userId: adminAUserId,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/organization/employees')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .send({
        firstName: 'Dup',
        lastName: 'User',
        email: `linked-dup-${suffix}@example.com`,
        areaId: areaAId,
        positionId: positionAId,
        userId: adminAUserId,
      })
      .expect(409);

    // Same user can be employee in another company
    await request(app.getHttpServer())
      .post('/organization/employees')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyBId)
      .send({
        firstName: 'Linked',
        lastName: 'OtherCo',
        email: `linked-b-${suffix}@example.com`,
        areaId: areaBId,
        positionId: (
          await prisma.position.findFirstOrThrow({
            where: { companyId: companyBId, deletedAt: null },
          })
        ).id,
        userId: adminAUserId,
      })
      .expect(201);

    expect((linked.body as { userId: string }).userId).toBe(adminAUserId);
  });

  it('validates reporting lines: self, unique direct, multiple indirect, same company, cycles', async () => {
    await request(app.getHttpServer())
      .post(`/organization/employees/${employeeAId}/reporting-lines`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .send({
        managerEmployeeId: employeeAId,
        type: ReportingLineType.DIRECT,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/organization/employees/${employeeAId}/reporting-lines`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .send({
        managerEmployeeId: employeeBId,
        type: ReportingLineType.DIRECT,
      })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/organization/employees/${employeeAId}/reporting-lines`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .send({
        managerEmployeeId: managerAId,
        type: ReportingLineType.DIRECT,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/organization/employees/${employeeAId}/reporting-lines`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .send({
        managerEmployeeId: managerAId,
        type: ReportingLineType.DIRECT,
      })
      .expect(409);

    const mid = await request(app.getHttpServer())
      .post('/organization/employees')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .send({
        firstName: 'Mid',
        lastName: 'Manager',
        email: `mid-${suffix}@example.com`,
        areaId: areaAId,
        positionId: positionAId,
      })
      .expect(201);
    const midId = (mid.body as { id: string }).id;

    await request(app.getHttpServer())
      .post(`/organization/employees/${employeeAId}/reporting-lines`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .send({
        managerEmployeeId: midId,
        type: ReportingLineType.INDIRECT,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/organization/employees/${employeeAId}/reporting-lines`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .send({
        managerEmployeeId: managerAId,
        type: ReportingLineType.INDIRECT,
      })
      .expect(201);

    // Cycle: managerA -> employeeA already; add employeeA as manager of managerA
    await request(app.getHttpServer())
      .post(`/organization/employees/${managerAId}/reporting-lines`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .send({
        managerEmployeeId: employeeAId,
        type: ReportingLineType.INDIRECT,
      })
      .expect(400);
  });

  it('detects area hierarchy cycles and same-company parent', async () => {
    const child = await request(app.getHttpServer())
      .post('/organization/areas')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .send({
        name: `Child Area ${suffix}`,
        parentAreaId: areaAId,
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/organization/areas/${areaAId}`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .send({ parentAreaId: (child.body as { id: string }).id })
      .expect(400);

    await request(app.getHttpServer())
      .post('/organization/areas')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .send({
        name: `Bad Parent ${suffix}`,
        parentAreaId: areaBId,
      })
      .expect(404);
  });

  it('rejects negative headcount and childrenCount', async () => {
    await request(app.getHttpServer())
      .post('/organization/positions')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .send({
        name: `Neg Head ${suffix}`,
        areaId: areaAId,
        headcount: -1,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/organization/employees')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .send({
        firstName: 'Neg',
        lastName: 'Kids',
        email: `negkids-${suffix}@example.com`,
        areaId: areaAId,
        positionId: positionAId,
        childrenCount: -2,
      })
      .expect(400);
  });

  it('paginates and searches within tenant only', async () => {
    const page = await request(app.getHttpServer())
      .get('/organization/employees')
      .query({ page: 1, limit: 1, search: 'Ada' })
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .expect(200);

    const body = page.body as {
      items: Array<{ email: string }>;
      total: number;
      page: number;
      limit: number;
    };
    expect(body.page).toBe(1);
    expect(body.limit).toBe(1);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.email).toContain('ada-');
    expect(JSON.stringify(body)).not.toContain('alan-');
  });

  it('returns areas tree scoped to tenant', async () => {
    const tree = await request(app.getHttpServer())
      .get('/organization/areas/tree')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .expect(200);

    const payload = JSON.stringify(tree.body);
    expect(payload).toContain(areaAId);
    expect(payload).not.toContain(areaBId);
  });

  it('returns organization profile for employee', async () => {
    const profile = await request(app.getHttpServer())
      .get(`/organization/employees/${employeeAId}/organization-profile`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .expect(200);

    expect(profile.body).toMatchObject({
      id: employeeAId,
      area: { id: areaAId },
      position: { id: positionAId },
      jobLevel: { id: jobLevelAId },
      directManager: { id: managerAId },
    });
  });
});
