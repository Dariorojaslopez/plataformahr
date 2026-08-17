import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
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
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { formatDuplicateCompanyCodeMessage } from '../src/common/prisma/duplicate-company-code';

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
    app.useGlobalFilters(
      new AllExceptionsFilter(app.get(HttpAdapterHost), false),
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

  it('returns clear 409 messages for duplicate codes in the same company', async () => {
    const headers = {
      Authorization: `Bearer ${adminAToken}`,
      'X-Company-Id': companyAId,
    };
    const headersB = {
      Authorization: `Bearer ${adminBToken}`,
      'X-Company-Id': companyBId,
    };

    await request(app.getHttpServer())
      .post('/organization/business-units')
      .set(headers)
      .send({ name: `BU code ${suffix}`, code: `DUP-BU-${suffix}` })
      .expect(201);
    const dupBu = await request(app.getHttpServer())
      .post('/organization/business-units')
      .set(headers)
      .send({ name: `BU code other ${suffix}`, code: `DUP-BU-${suffix}` })
      .expect(409);
    expect((dupBu.body as { message: string }).message).toBe(
      formatDuplicateCompanyCodeMessage('BusinessUnit', `DUP-BU-${suffix}`),
    );
    expect((dupBu.body as { message: string }).message).not.toContain(
      companyAId,
    );

    await request(app.getHttpServer())
      .post('/organization/areas')
      .set(headers)
      .send({ name: `Area code ${suffix}`, code: `DUP-AR-${suffix}` })
      .expect(201);
    const dupArea = await request(app.getHttpServer())
      .post('/organization/areas')
      .set(headers)
      .send({ name: `Area code other ${suffix}`, code: `DUP-AR-${suffix}` })
      .expect(409);
    expect((dupArea.body as { message: string }).message).toBe(
      formatDuplicateCompanyCodeMessage('Area', `DUP-AR-${suffix}`),
    );

    await request(app.getHttpServer())
      .post('/organization/job-levels')
      .set(headers)
      .send({
        name: `Level code ${suffix}`,
        code: `DUP-JL-${suffix}`,
        rank: 910,
      })
      .expect(201);
    const dupLevel = await request(app.getHttpServer())
      .post('/organization/job-levels')
      .set(headers)
      .send({
        name: `Level code other ${suffix}`,
        code: `DUP-JL-${suffix}`,
        rank: 911,
      })
      .expect(409);
    expect((dupLevel.body as { message: string }).message).toBe(
      formatDuplicateCompanyCodeMessage('JobLevel', `DUP-JL-${suffix}`),
    );

    await request(app.getHttpServer())
      .post('/organization/positions')
      .set(headers)
      .send({
        name: `Position code ${suffix}`,
        code: `DUP-PO-${suffix}`,
        areaId: areaAId,
        headcount: 1,
      })
      .expect(201);
    const dupPos = await request(app.getHttpServer())
      .post('/organization/positions')
      .set(headers)
      .send({
        name: `Position code other ${suffix}`,
        code: `DUP-PO-${suffix}`,
        areaId: areaAId,
        headcount: 1,
      })
      .expect(409);
    expect((dupPos.body as { message: string }).message).toBe(
      formatDuplicateCompanyCodeMessage('Position', `DUP-PO-${suffix}`),
    );

    await request(app.getHttpServer())
      .post('/organization/business-units')
      .set(headersB)
      .send({ name: `BU B code ${suffix}`, code: `DUP-BU-${suffix}` })
      .expect(201);

    const keepOwn = await request(app.getHttpServer())
      .post('/organization/areas')
      .set(headers)
      .send({ name: `Area keep ${suffix}`, code: `KEEP-AR-${suffix}` })
      .expect(201);
    const keepId = (keepOwn.body as { id: string }).id;
    await request(app.getHttpServer())
      .patch(`/organization/areas/${keepId}`)
      .set(headers)
      .send({ code: `KEEP-AR-${suffix}`, name: `Area keep updated ${suffix}` })
      .expect(200);

    const steal = await request(app.getHttpServer())
      .post('/organization/areas')
      .set(headers)
      .send({ name: `Area steal ${suffix}`, code: `STEAL-AR-${suffix}` })
      .expect(201);
    const stealUpdate = await request(app.getHttpServer())
      .patch(`/organization/areas/${(steal.body as { id: string }).id}`)
      .set(headers)
      .send({ code: `KEEP-AR-${suffix}` })
      .expect(409);
    expect((stealUpdate.body as { message: string }).message).toBe(
      formatDuplicateCompanyCodeMessage('Area', `KEEP-AR-${suffix}`),
    );

    const nameClash = await request(app.getHttpServer())
      .post('/organization/areas')
      .set(headers)
      .send({
        name: `Area keep updated ${suffix}`,
        code: `NAME-CLASH-${suffix}`,
      })
      .expect(409);
    expect((nameClash.body as { message: string }).message).toBe(
      'Resource conflict',
    );
    expect((nameClash.body as { message: string }).message).not.toMatch(
      /código/i,
    );
  });

  describe('optional business units', () => {
    let companyCId = '';
    let adminCToken = '';
    let areaWithoutBuId = '';

    const headersA = () => ({
      Authorization: `Bearer ${adminAToken}`,
      'X-Company-Id': companyAId,
    });
    const headersC = () => ({
      Authorization: `Bearer ${adminCToken}`,
      'X-Company-Id': companyCId,
    });

    beforeAll(async () => {
      const companyC = await prisma.company.create({
        data: {
          name: `Org C ${suffix}`,
          slug: `org-c-${suffix}`,
          status: CompanyStatus.ACTIVE,
        },
      });
      companyCId = companyC.id;

      const password = `OrgPass-${suffix}!`;
      const adminC = await prisma.user.create({
        data: {
          email: `orgc-admin-${suffix}@example.com`,
          passwordHash: await hasher.hash(password),
          firstName: 'Admin',
          lastName: 'C',
          status: UserStatus.ACTIVE,
        },
      });
      const roleAdmin = await prisma.role.findUniqueOrThrow({
        where: {
          scope_code: { scope: RoleScope.COMPANY, code: 'CLIENT_ADMIN' },
        },
      });
      const membership = await prisma.companyMembership.create({
        data: {
          userId: adminC.id,
          companyId: companyC.id,
          status: MembershipStatus.ACTIVE,
        },
      });
      await prisma.membershipRole.create({
        data: { membershipId: membership.id, roleId: roleAdmin.id },
      });

      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: `orgc-admin-${suffix}@example.com`, password })
        .expect(201);
      adminCToken = (login.body as LoginBody).accessToken;
    });

    it('creates an area without a business unit', async () => {
      const res = await request(app.getHttpServer())
        .post('/organization/areas')
        .set(headersA())
        .send({ name: `Area no BU ${suffix}` })
        .expect(201);
      expect(
        (res.body as { businessUnitId: string | null }).businessUnitId,
      ).toBeNull();
      areaWithoutBuId = (res.body as { id: string }).id;
    });

    it('creates an area with a business unit', async () => {
      const res = await request(app.getHttpServer())
        .post('/organization/areas')
        .set(headersA())
        .send({
          name: `Area with BU ${suffix}`,
          businessUnitId: businessUnitAId,
        })
        .expect(201);
      expect((res.body as { businessUnitId: string }).businessUnitId).toBe(
        businessUnitAId,
      );
    });

    it('assigns a business unit to an area that had none', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/organization/areas/${areaWithoutBuId}`)
        .set(headersA())
        .send({ businessUnitId: businessUnitAId })
        .expect(200);
      expect((res.body as { businessUnitId: string }).businessUnitId).toBe(
        businessUnitAId,
      );
      expect((res.body as { id: string }).id).toBe(areaWithoutBuId);
    });

    it('clears the business unit from an area without recreating it', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/organization/areas/${areaWithoutBuId}`)
        .set(headersA())
        .send({ businessUnitId: null })
        .expect(200);
      expect(
        (res.body as { businessUnitId: string | null }).businessUnitId,
      ).toBeNull();
      expect((res.body as { id: string }).id).toBe(areaWithoutBuId);
    });

    it('rejects a business unit from another tenant on an area', async () => {
      const buB = await request(app.getHttpServer())
        .post('/organization/business-units')
        .set('Authorization', `Bearer ${adminBToken}`)
        .set('X-Company-Id', companyBId)
        .send({ name: `BU B area-cross ${suffix}` })
        .expect(201);

      await request(app.getHttpServer())
        .post('/organization/areas')
        .set(headersA())
        .send({
          name: `Cross BU area ${suffix}`,
          businessUnitId: (buB.body as { id: string }).id,
        })
        .expect(404);

      await request(app.getHttpServer())
        .patch(`/organization/areas/${areaAId}`)
        .set(headersA())
        .send({ businessUnitId: (buB.body as { id: string }).id })
        .expect(404);
    });

    it('rejects fictitious businessUnitId values from the client', async () => {
      await request(app.getHttpServer())
        .post('/organization/areas')
        .set(headersA())
        .send({ name: `Fake none ${suffix}`, businessUnitId: 'none' })
        .expect(400);

      await request(app.getHttpServer())
        .post('/organization/areas')
        .set(headersA())
        .send({ name: `Fake none2 ${suffix}`, businessUnitId: '__none__' })
        .expect(400);
    });

    it('lets a company with zero business units use areas, positions and employees', async () => {
      const units = await request(app.getHttpServer())
        .get('/organization/business-units')
        .set(headersC())
        .expect(200);
      expect(units.body).toEqual([]);

      const area1 = await request(app.getHttpServer())
        .post('/organization/areas')
        .set(headersC())
        .send({ name: `C Area 1 ${suffix}` })
        .expect(201);
      const area2 = await request(app.getHttpServer())
        .post('/organization/areas')
        .set(headersC())
        .send({ name: `C Area 2 ${suffix}` })
        .expect(201);
      expect(
        (area1.body as { businessUnitId: string | null }).businessUnitId,
      ).toBeNull();
      expect(
        (area2.body as { businessUnitId: string | null }).businessUnitId,
      ).toBeNull();

      const listed = await request(app.getHttpServer())
        .get('/organization/areas')
        .set(headersC())
        .expect(200);
      const areaIds = (listed.body as Array<{ id: string }>).map(
        (area) => area.id,
      );
      expect(areaIds).toEqual(
        expect.arrayContaining([
          (area1.body as { id: string }).id,
          (area2.body as { id: string }).id,
        ]),
      );

      const tree = await request(app.getHttpServer())
        .get('/organization/areas/tree')
        .set(headersC())
        .expect(200);
      expect(
        (tree.body as Array<{ businessUnitId: string | null }>).every(
          (node) => node.businessUnitId === null,
        ),
      ).toBe(true);

      const level = await request(app.getHttpServer())
        .post('/organization/job-levels')
        .set(headersC())
        .send({ name: `C Level ${suffix}`, rank: 1 })
        .expect(201);

      const position = await request(app.getHttpServer())
        .post('/organization/positions')
        .set(headersC())
        .send({
          name: `C Position ${suffix}`,
          areaId: (area1.body as { id: string }).id,
          jobLevelId: (level.body as { id: string }).id,
          headcount: 1,
        })
        .expect(201);

      const employee = await request(app.getHttpServer())
        .post('/organization/employees')
        .set(headersC())
        .send({
          firstName: 'No',
          lastName: 'Unit',
          email: `c-emp-${suffix}@example.com`,
          areaId: (area1.body as { id: string }).id,
          positionId: (position.body as { id: string }).id,
        })
        .expect(201);
      expect(
        (employee.body as { businessUnitId: string | null }).businessUnitId,
      ).toBeNull();
    });

    it('keeps companies that already use business units working', async () => {
      const units = await request(app.getHttpServer())
        .get('/organization/business-units')
        .set(headersA())
        .expect(200);
      expect((units.body as unknown[]).length).toBeGreaterThan(0);

      const areas = await request(app.getHttpServer())
        .get('/organization/areas')
        .set(headersA())
        .expect(200);
      expect(
        (
          areas.body as Array<{ id: string; businessUnitId: string | null }>
        ).some(
          (area) =>
            area.id === areaAId && area.businessUnitId === businessUnitAId,
        ),
      ).toBe(true);
    });
  });

  describe('job level competencies', () => {
    type CompetencyRef = { id: string; name: string; code: string | null };
    type Payload = {
      jobLevelId: string;
      assigned: CompetencyRef[];
      catalog: CompetencyRef[];
    };

    let competencyTeamId = '';
    let competencyLeadId = '';
    let competencyCustomerId = '';
    let competencyBId = '';
    let levelLeaderId = '';
    let companyDId = '';
    let adminDToken = '';

    const headersA = () => ({
      Authorization: `Bearer ${adminAToken}`,
      'X-Company-Id': companyAId,
    });

    beforeAll(async () => {
      const team = await request(app.getHttpServer())
        .post('/performance/competencies')
        .set(headersA())
        .send({ name: `Trabajo en equipo ${suffix}`, code: `TE-${suffix}` })
        .expect(201);
      competencyTeamId = (team.body as { id: string }).id;

      const lead = await request(app.getHttpServer())
        .post('/performance/competencies')
        .set(headersA())
        .send({ name: `Liderazgo ${suffix}`, code: `LD-${suffix}` })
        .expect(201);
      competencyLeadId = (lead.body as { id: string }).id;

      const customer = await request(app.getHttpServer())
        .post('/performance/competencies')
        .set(headersA())
        .send({ name: `Orientación al cliente ${suffix}` })
        .expect(201);
      competencyCustomerId = (customer.body as { id: string }).id;

      const leadLevel = await request(app.getHttpServer())
        .post('/organization/job-levels')
        .set(headersA())
        .send({ name: `Líder ${suffix}`, rank: 80 })
        .expect(201);
      levelLeaderId = (leadLevel.body as { id: string }).id;

      const compB = await request(app.getHttpServer())
        .post('/performance/competencies')
        .set('Authorization', `Bearer ${adminBToken}`)
        .set('X-Company-Id', companyBId)
        .send({ name: `Competencia B ${suffix}` })
        .expect(201);
      competencyBId = (compB.body as { id: string }).id;

      const companyD = await prisma.company.create({
        data: {
          name: `Org D ${suffix}`,
          slug: `org-d-${suffix}`,
          status: CompanyStatus.ACTIVE,
        },
      });
      companyDId = companyD.id;
      const password = `OrgPass-${suffix}!`;
      const adminD = await prisma.user.create({
        data: {
          email: `orgd-admin-${suffix}@example.com`,
          passwordHash: await hasher.hash(password),
          firstName: 'Admin',
          lastName: 'D',
          status: UserStatus.ACTIVE,
        },
      });
      const roleAdmin = await prisma.role.findUniqueOrThrow({
        where: {
          scope_code: { scope: RoleScope.COMPANY, code: 'CLIENT_ADMIN' },
        },
      });
      const membership = await prisma.companyMembership.create({
        data: {
          userId: adminD.id,
          companyId: companyD.id,
          status: MembershipStatus.ACTIVE,
        },
      });
      await prisma.membershipRole.create({
        data: { membershipId: membership.id, roleId: roleAdmin.id },
      });
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: `orgd-admin-${suffix}@example.com`, password })
        .expect(201);
      adminDToken = (login.body as LoginBody).accessToken;
    });

    it('starts a job level with no competencies', async () => {
      const res = await request(app.getHttpServer())
        .get(`/organization/job-levels/${jobLevelAId}/competencies`)
        .set(headersA())
        .expect(200);
      const body = res.body as Payload;
      expect(body.jobLevelId).toBe(jobLevelAId);
      expect(body.assigned).toEqual([]);
      expect(body.catalog.map((item) => item.id)).toEqual(
        expect.arrayContaining([
          competencyTeamId,
          competencyLeadId,
          competencyCustomerId,
        ]),
      );
      expect(body.catalog.map((item) => item.id)).not.toContain(competencyBId);
    });

    it('assigns one competency then several', async () => {
      const one = await request(app.getHttpServer())
        .put(`/organization/job-levels/${jobLevelAId}/competencies`)
        .set(headersA())
        .send({ competencyIds: [competencyTeamId] })
        .expect(200);
      expect((one.body as Payload).assigned.map((item) => item.id)).toEqual([
        competencyTeamId,
      ]);

      const many = await request(app.getHttpServer())
        .put(`/organization/job-levels/${jobLevelAId}/competencies`)
        .set(headersA())
        .send({
          competencyIds: [competencyTeamId, competencyCustomerId],
        })
        .expect(200);
      expect(
        (many.body as Payload).assigned.map((item) => item.id).sort(),
      ).toEqual([competencyTeamId, competencyCustomerId].sort());
    });

    it('allows the same competency on multiple job levels', async () => {
      await request(app.getHttpServer())
        .put(`/organization/job-levels/${levelLeaderId}/competencies`)
        .set(headersA())
        .send({
          competencyIds: [competencyTeamId, competencyLeadId],
        })
        .expect(200);

      const operative = await request(app.getHttpServer())
        .get(`/organization/job-levels/${jobLevelAId}/competencies`)
        .set(headersA())
        .expect(200);
      const leader = await request(app.getHttpServer())
        .get(`/organization/job-levels/${levelLeaderId}/competencies`)
        .set(headersA())
        .expect(200);
      expect(
        (operative.body as Payload).assigned.map((item) => item.id),
      ).toContain(competencyTeamId);
      expect((leader.body as Payload).assigned.map((item) => item.id)).toEqual(
        expect.arrayContaining([competencyTeamId, competencyLeadId]),
      );
    });

    it('replaces the selection and can clear all', async () => {
      const replaced = await request(app.getHttpServer())
        .put(`/organization/job-levels/${jobLevelAId}/competencies`)
        .set(headersA())
        .send({ competencyIds: [competencyLeadId] })
        .expect(200);
      expect(
        (replaced.body as Payload).assigned.map((item) => item.id),
      ).toEqual([competencyLeadId]);

      const cleared = await request(app.getHttpServer())
        .put(`/organization/job-levels/${jobLevelAId}/competencies`)
        .set(headersA())
        .send({ competencyIds: [] })
        .expect(200);
      expect((cleared.body as Payload).assigned).toEqual([]);
    });

    it('rejects duplicate competency ids in the payload', async () => {
      await request(app.getHttpServer())
        .put(`/organization/job-levels/${jobLevelAId}/competencies`)
        .set(headersA())
        .send({ competencyIds: [competencyTeamId, competencyTeamId] })
        .expect(400);
    });

    it('rejects a competency from another tenant', async () => {
      await request(app.getHttpServer())
        .put(`/organization/job-levels/${jobLevelAId}/competencies`)
        .set(headersA())
        .send({ competencyIds: [competencyBId] })
        .expect(404);
    });

    it('hides another company job level and its configuration', async () => {
      const levelB = await request(app.getHttpServer())
        .post('/organization/job-levels')
        .set('Authorization', `Bearer ${adminBToken}`)
        .set('X-Company-Id', companyBId)
        .send({ name: `Level B comps ${suffix}`, rank: 50 })
        .expect(201);
      const levelBId = (levelB.body as { id: string }).id;

      await request(app.getHttpServer())
        .put(`/organization/job-levels/${levelBId}/competencies`)
        .set('Authorization', `Bearer ${adminBToken}`)
        .set('X-Company-Id', companyBId)
        .send({ competencyIds: [competencyBId] })
        .expect(200);

      await request(app.getHttpServer())
        .get(`/organization/job-levels/${levelBId}/competencies`)
        .set(headersA())
        .expect(404);

      await request(app.getHttpServer())
        .put(`/organization/job-levels/${levelBId}/competencies`)
        .set(headersA())
        .send({ competencyIds: [competencyTeamId] })
        .expect(404);
    });

    it('enforces organization.read vs manage on competency assignment', async () => {
      await request(app.getHttpServer())
        .get(`/organization/job-levels/${jobLevelAId}/competencies`)
        .set('Authorization', `Bearer ${readerToken}`)
        .set('X-Company-Id', companyAId)
        .expect(200);

      await request(app.getHttpServer())
        .put(`/organization/job-levels/${jobLevelAId}/competencies`)
        .set('Authorization', `Bearer ${readerToken}`)
        .set('X-Company-Id', companyAId)
        .send({ competencyIds: [competencyTeamId] })
        .expect(403);
    });

    it('does not create two rows for the same job level and competency', async () => {
      await request(app.getHttpServer())
        .put(`/organization/job-levels/${levelLeaderId}/competencies`)
        .set(headersA())
        .send({ competencyIds: [competencyTeamId] })
        .expect(200);
      await request(app.getHttpServer())
        .put(`/organization/job-levels/${levelLeaderId}/competencies`)
        .set(headersA())
        .send({ competencyIds: [competencyTeamId] })
        .expect(200);

      const rows = await prisma.jobLevelCompetency.findMany({
        where: { jobLevelId: levelLeaderId, competencyId: competencyTeamId },
      });
      expect(rows).toHaveLength(1);
    });

    it('configures competencies on a company with no business units', async () => {
      const headersD = {
        Authorization: `Bearer ${adminDToken}`,
        'X-Company-Id': companyDId,
      };
      const units = await request(app.getHttpServer())
        .get('/organization/business-units')
        .set(headersD)
        .expect(200);
      expect(units.body).toEqual([]);

      const level = await request(app.getHttpServer())
        .post('/organization/job-levels')
        .set(headersD)
        .send({ name: `D Level ${suffix}`, rank: 1 })
        .expect(201);
      const competency = await request(app.getHttpServer())
        .post('/performance/competencies')
        .set(headersD)
        .send({ name: `D Comp ${suffix}` })
        .expect(201);

      const saved = await request(app.getHttpServer())
        .put(
          `/organization/job-levels/${(level.body as { id: string }).id}/competencies`,
        )
        .set(headersD)
        .send({ competencyIds: [(competency.body as { id: string }).id] })
        .expect(200);
      expect((saved.body as Payload).assigned).toHaveLength(1);
    });
  });
});
