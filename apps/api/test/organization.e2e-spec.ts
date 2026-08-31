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
      `Ya existe un área con el nombre Area keep updated ${suffix}.`,
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

  describe('position custom fields', () => {
    const headersA = () => ({
      Authorization: `Bearer ${adminAToken}`,
      'X-Company-Id': companyAId,
    });
    const headersB = () => ({
      Authorization: `Bearer ${adminBToken}`,
      'X-Company-Id': companyBId,
    });

    type FieldBody = {
      id: string;
      key: string;
      label: string;
      type: string;
      appliesTo?: string;
      required: boolean;
      active: boolean;
      options: Array<{ id: string; label: string; active: boolean }>;
    };
    type PositionBody = {
      id: string;
      name: string;
      customFields: Array<{
        definitionId: string;
        label: string;
        value: string | number | boolean | null;
        optionId: string | null;
        optionLabel: string | null;
      }>;
    };

    let textId = '';
    let numberId = '';
    let booleanId = '';
    let dateId = '';
    let selectId = '';
    let optionId = '';
    let optionBId = '';
    let customPositionId = '';

    it('creates TEXT NUMBER BOOLEAN DATE and SELECT definitions', async () => {
      const text = await request(app.getHttpServer())
        .post('/organization/position-custom-fields')
        .set(headersA())
        .send({ key: 'codigo_sap', label: 'Código SAP', type: 'TEXT' })
        .expect(201);
      textId = (text.body as FieldBody).id;

      const number = await request(app.getHttpServer())
        .post('/organization/position-custom-fields')
        .set(headersA())
        .send({ key: 'centro_costo', label: 'Centro de costo', type: 'NUMBER' })
        .expect(201);
      numberId = (number.body as FieldBody).id;

      const bool = await request(app.getHttpServer())
        .post('/organization/position-custom-fields')
        .set(headersA())
        .send({
          key: 'requiere_licencia',
          label: 'Requiere licencia',
          type: 'BOOLEAN',
        })
        .expect(201);
      booleanId = (bool.body as FieldBody).id;

      const date = await request(app.getHttpServer())
        .post('/organization/position-custom-fields')
        .set(headersA())
        .send({ key: 'vigencia', label: 'Vigencia', type: 'DATE' })
        .expect(201);
      dateId = (date.body as FieldBody).id;

      const select = await request(app.getHttpServer())
        .post('/organization/position-custom-fields')
        .set(headersA())
        .send({
          key: 'familia_cargo',
          label: 'Familia de cargo',
          type: 'SELECT',
          options: [{ label: 'Operaciones' }, { label: 'Staff' }],
        })
        .expect(201);
      const selectBody = select.body as FieldBody;
      selectId = selectBody.id;
      optionId = selectBody.options[0].id;

      const listed = await request(app.getHttpServer())
        .get('/organization/position-custom-fields')
        .set(headersA())
        .expect(200);
      expect((listed.body as FieldBody[]).map((item) => item.key)).toEqual(
        expect.arrayContaining([
          'codigo_sap',
          'centro_costo',
          'requiere_licencia',
          'vigencia',
          'familia_cargo',
        ]),
      );
    });

    it('rejects a duplicate key in the same company and allows it in another', async () => {
      await request(app.getHttpServer())
        .post('/organization/position-custom-fields')
        .set(headersA())
        .send({ key: 'codigo_sap', label: 'Otro', type: 'TEXT' })
        .expect(409);

      const other = await request(app.getHttpServer())
        .post('/organization/position-custom-fields')
        .set(headersB())
        .send({
          key: 'codigo_sap',
          label: 'Código SAP B',
          type: 'SELECT',
          options: [{ label: 'B1' }],
        })
        .expect(201);
      optionBId = (other.body as FieldBody).options[0].id;
    });

    it('creates a position with valid custom values', async () => {
      const created = await request(app.getHttpServer())
        .post('/organization/positions')
        .set(headersA())
        .send({
          name: `Custom Position ${suffix}`,
          areaId: areaAId,
          customFields: [
            { definitionId: textId, value: 'SAP-100' },
            { definitionId: numberId, value: 2100 },
            { definitionId: booleanId, value: true },
            { definitionId: dateId, value: '2026-08-17' },
            { definitionId: selectId, value: optionId },
          ],
        })
        .expect(201);
      const body = created.body as PositionBody;
      customPositionId = body.id;
      expect(body.customFields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ definitionId: textId, value: 'SAP-100' }),
          expect.objectContaining({ definitionId: numberId, value: 2100 }),
          expect.objectContaining({ definitionId: booleanId, value: true }),
          expect.objectContaining({
            definitionId: dateId,
            value: '2026-08-17',
          }),
          expect.objectContaining({
            definitionId: selectId,
            value: optionId,
            optionLabel: 'Operaciones',
          }),
        ]),
      );
    });

    it('rejects missing required values, invalid types and invalid SELECT options', async () => {
      const required = await request(app.getHttpServer())
        .post('/organization/position-custom-fields')
        .set(headersA())
        .send({
          key: 'observaciones_int',
          label: 'Observaciones internas',
          type: 'TEXT',
          required: true,
        })
        .expect(201);
      const requiredId = (required.body as FieldBody).id;

      await request(app.getHttpServer())
        .post('/organization/positions')
        .set(headersA())
        .send({
          name: `Missing required ${suffix}`,
          areaId: areaAId,
          customFields: [{ definitionId: textId, value: 'x' }],
        })
        .expect(400);

      await request(app.getHttpServer())
        .post('/organization/positions')
        .send({
          name: `Bad number ${suffix}`,
          areaId: areaAId,
          customFields: [
            { definitionId: requiredId, value: 'ok' },
            { definitionId: numberId, value: 'nope' },
          ],
        })
        .set(headersA())
        .expect(400);

      await request(app.getHttpServer())
        .post('/organization/positions')
        .set(headersA())
        .send({
          name: `Bad select ${suffix}`,
          areaId: areaAId,
          customFields: [
            { definitionId: requiredId, value: 'ok' },
            { definitionId: selectId, value: optionBId },
          ],
        })
        .expect(400);

      await request(app.getHttpServer())
        .patch(`/organization/position-custom-fields/${requiredId}`)
        .set(headersA())
        .send({ active: false })
        .expect(200);
    });

    it('edits position custom values', async () => {
      const updated = await request(app.getHttpServer())
        .patch(`/organization/positions/${customPositionId}`)
        .set(headersA())
        .send({
          customFields: [
            { definitionId: textId, value: 'SAP-200' },
            { definitionId: numberId, value: 2100 },
            { definitionId: booleanId, value: false },
            { definitionId: dateId, value: '2026-08-17' },
            { definitionId: selectId, value: optionId },
          ],
        })
        .expect(200);
      expect(
        (updated.body as PositionBody).customFields.find(
          (field) => field.definitionId === textId,
        )?.value,
      ).toBe('SAP-200');
    });

    it('keeps values after deactivating or renaming a definition', async () => {
      await request(app.getHttpServer())
        .patch(`/organization/position-custom-fields/${textId}`)
        .set(headersA())
        .send({ label: 'Código SAP interno', active: false })
        .expect(200);

      const detail = await request(app.getHttpServer())
        .get(`/organization/positions/${customPositionId}`)
        .set(headersA())
        .expect(200);
      const field = (detail.body as PositionBody).customFields.find(
        (item) => item.definitionId === textId,
      );
      expect(field?.value).toBe('SAP-200');
      expect(field?.label).toBe('Código SAP interno');
    });

    it('rejects an unsafe type change when values exist', async () => {
      await request(app.getHttpServer())
        .patch(`/organization/position-custom-fields/${numberId}`)
        .set(headersA())
        .send({ type: 'TEXT' })
        .expect(409);
    });

    it('rejects cross-tenant definition and option ids without leaking data', async () => {
      const createdB = await request(app.getHttpServer())
        .post('/organization/position-custom-fields')
        .set(headersB())
        .send({ key: 'solo_b', label: 'Solo B', type: 'TEXT' })
        .expect(201);
      const definitionBId = (createdB.body as FieldBody).id;

      await request(app.getHttpServer())
        .patch(`/organization/position-custom-fields/${definitionBId}`)
        .set(headersA())
        .send({ label: 'Hacked' })
        .expect(404);

      await request(app.getHttpServer())
        .post('/organization/positions')
        .set(headersA())
        .send({
          name: `Cross tenant field ${suffix}`,
          areaId: areaAId,
          customFields: [{ definitionId: definitionBId, value: 'nope' }],
        })
        .expect(404);

      const listed = await request(app.getHttpServer())
        .get('/organization/position-custom-fields')
        .set(headersA())
        .expect(200);
      expect((listed.body as FieldBody[]).map((item) => item.id)).not.toContain(
        definitionBId,
      );
    });

    it('enforces organization.read vs manage and keeps historic positions working', async () => {
      await request(app.getHttpServer())
        .get('/organization/position-custom-fields')
        .set('Authorization', `Bearer ${readerToken}`)
        .set('X-Company-Id', companyAId)
        .expect(200);

      await request(app.getHttpServer())
        .post('/organization/position-custom-fields')
        .set('Authorization', `Bearer ${readerToken}`)
        .set('X-Company-Id', companyAId)
        .send({ key: 'forbidden', label: 'Forbidden', type: 'TEXT' })
        .expect(403);

      const historic = await request(app.getHttpServer())
        .get(`/organization/positions/${positionAId}`)
        .set(headersA())
        .expect(200);
      expect((historic.body as PositionBody).id).toBe(positionAId);
      expect(Array.isArray((historic.body as PositionBody).customFields)).toBe(
        true,
      );

      await request(app.getHttpServer())
        .patch(`/organization/positions/${positionAId}`)
        .set(headersA())
        .send({ name: `Position A ${suffix}` })
        .expect(200);
    });

    it('scopes definitions to Cargos or Colaboradores', async () => {
      const employeeField = await request(app.getHttpServer())
        .post('/organization/position-custom-fields')
        .set(headersA())
        .send({
          key: 'talla_uniforme',
          label: 'Talla de uniforme',
          type: 'TEXT',
          appliesTo: 'EMPLOYEE',
          required: true,
        })
        .expect(201);
      const employeeFieldId = (employeeField.body as FieldBody).id;
      expect((employeeField.body as FieldBody).appliesTo).toBe('EMPLOYEE');

      await request(app.getHttpServer())
        .post('/organization/position-custom-fields')
        .set(headersA())
        .send({
          key: 'talla_uniforme',
          label: 'Talla cargo',
          type: 'TEXT',
          appliesTo: 'POSITION',
        })
        .expect(201);

      const listed = await request(app.getHttpServer())
        .get('/organization/position-custom-fields')
        .set(headersA())
        .expect(200);
      const talla = (listed.body as FieldBody[]).filter(
        (item) => item.key === 'talla_uniforme',
      );
      expect(talla).toHaveLength(2);

      await request(app.getHttpServer())
        .post('/organization/positions')
        .set(headersA())
        .send({
          name: `No employee fields ${suffix}`,
          areaId: areaAId,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/organization/employees')
        .set(headersA())
        .send({
          firstName: 'Ana',
          lastName: 'Campo',
          email: `ana-campo-${suffix}@example.com`,
          areaId: areaAId,
          positionId: positionAId,
        })
        .expect(400);

      const createdEmployee = await request(app.getHttpServer())
        .post('/organization/employees')
        .set(headersA())
        .send({
          firstName: 'Ana',
          lastName: 'Campo',
          email: `ana-campo-${suffix}@example.com`,
          areaId: areaAId,
          positionId: positionAId,
          customFields: [{ definitionId: employeeFieldId, value: 'M' }],
        })
        .expect(201);
      expect(
        (
          createdEmployee.body as {
            customFields: Array<{ definitionId: string; value: string }>;
          }
        ).customFields,
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            definitionId: employeeFieldId,
            value: 'M',
          }),
        ]),
      );

      await request(app.getHttpServer())
        .post('/organization/employees')
        .set(headersA())
        .send({
          firstName: 'Luis',
          lastName: 'Cargo',
          email: `luis-cargo-${suffix}@example.com`,
          areaId: areaAId,
          positionId: positionAId,
          customFields: [{ definitionId: textId, value: 'nope' }],
        })
        .expect(404);

      const detail = await request(app.getHttpServer())
        .get(`/organization/employees/${employeeAId}`)
        .set(headersA())
        .expect(200);
      expect(
        Array.isArray(
          (detail.body as { customFields?: unknown[] }).customFields,
        ),
      ).toBe(true);

      await request(app.getHttpServer())
        .patch(`/organization/position-custom-fields/${employeeFieldId}`)
        .set(headersA())
        .send({ required: false })
        .expect(200);
    });
  });

  describe('organization chart', () => {
    const headersA = () => ({
      Authorization: `Bearer ${adminAToken}`,
      'X-Company-Id': companyAId,
    });
    const headersB = () => ({
      Authorization: `Bearer ${adminBToken}`,
      'X-Company-Id': companyBId,
    });

    type ChartNode = {
      employeeId: string;
      firstName: string;
      lastName: string;
      status: string;
      managerId: string | null;
      position: { name: string };
      jobLevel: { name: string } | null;
      area: { name: string };
      businessUnit: { name: string } | null;
      children: ChartNode[];
    };
    type ChartBody = {
      company: { id: string; name: string };
      includeInactive: boolean;
      employeeCount: number;
      rootCount: number;
      roots: ChartNode[];
    };

    function flatten(nodes: ChartNode[]): ChartNode[] {
      return nodes.flatMap((node) => [node, ...flatten(node.children)]);
    }

    it('returns an empty forest for a company without employees', async () => {
      const company = await prisma.company.create({
        data: {
          name: `Org Chart Empty ${suffix}`,
          slug: `org-chart-empty-${suffix}`,
          status: CompanyStatus.ACTIVE,
        },
      });
      const password = `OrgPass-${suffix}!`;
      const user = await prisma.user.create({
        data: {
          email: `orgchart-empty-${suffix}@example.com`,
          passwordHash: await hasher.hash(password),
          firstName: 'Empty',
          lastName: 'Admin',
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
          userId: user.id,
          companyId: company.id,
          status: MembershipStatus.ACTIVE,
        },
      });
      await prisma.membershipRole.create({
        data: { membershipId: membership.id, roleId: roleAdmin.id },
      });
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: `orgchart-empty-${suffix}@example.com`, password })
        .expect(201);
      const token = (login.body as LoginBody).accessToken;

      const res = await request(app.getHttpServer())
        .get('/organization/org-chart')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Company-Id', company.id)
        .expect(200);
      const body = res.body as ChartBody;
      expect(body.roots).toEqual([]);
      expect(body.employeeCount).toBe(0);
      expect(body.rootCount).toBe(0);
      expect(body.company.id).toBe(company.id);
    });

    it('builds one root, multiple roots and three DIRECT levels', async () => {
      const area = await request(app.getHttpServer())
        .post('/organization/areas')
        .set(headersA())
        .send({ name: `Chart Area ${suffix}` })
        .expect(201);
      const areaId = (area.body as { id: string }).id;
      const position = await request(app.getHttpServer())
        .post('/organization/positions')
        .set(headersA())
        .send({
          name: `Chart Position ${suffix}`,
          areaId,
          jobLevelId: jobLevelAId,
        })
        .expect(201);
      const positionId = (position.body as { id: string }).id;

      const root = await request(app.getHttpServer())
        .post('/organization/employees')
        .set(headersA())
        .send({
          firstName: 'Root',
          lastName: 'Chart',
          email: `chart-root-${suffix}@example.com`,
          areaId,
          positionId,
        })
        .expect(201);
      const mid = await request(app.getHttpServer())
        .post('/organization/employees')
        .set(headersA())
        .send({
          firstName: 'Mid',
          lastName: 'Chart',
          email: `chart-mid-${suffix}@example.com`,
          areaId,
          positionId,
        })
        .expect(201);
      const leaf = await request(app.getHttpServer())
        .post('/organization/employees')
        .set(headersA())
        .send({
          firstName: 'Leaf',
          lastName: 'Chart',
          email: `chart-leaf-${suffix}@example.com`,
          areaId,
          positionId,
        })
        .expect(201);
      const extraRoot = await request(app.getHttpServer())
        .post('/organization/employees')
        .set(headersA())
        .send({
          firstName: 'Solo',
          lastName: 'Chart',
          email: `chart-solo-${suffix}@example.com`,
          areaId,
          positionId,
        })
        .expect(201);

      const rootId = (root.body as { id: string }).id;
      const midId = (mid.body as { id: string }).id;
      const leafId = (leaf.body as { id: string }).id;
      const extraRootId = (extraRoot.body as { id: string }).id;

      await request(app.getHttpServer())
        .post(`/organization/employees/${midId}/reporting-lines`)
        .set(headersA())
        .send({ managerEmployeeId: rootId, type: ReportingLineType.DIRECT })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/organization/employees/${leafId}/reporting-lines`)
        .set(headersA())
        .send({ managerEmployeeId: midId, type: ReportingLineType.DIRECT })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/organization/org-chart')
        .set(headersA())
        .expect(200);
      const body = res.body as ChartBody;
      const nodes = flatten(body.roots);
      const rootNode = nodes.find((node) => node.employeeId === rootId);
      const extra = body.roots.find((node) => node.employeeId === extraRootId);

      expect(body.roots.length).toBeGreaterThanOrEqual(2);
      expect(extra?.managerId).toBeNull();
      expect(rootNode?.children[0]?.employeeId).toBe(midId);
      expect(rootNode?.children[0]?.children[0]?.employeeId).toBe(leafId);
      expect(rootNode?.jobLevel?.name).toBeTruthy();
      expect(JSON.stringify(body)).not.toMatch(
        /email|phone|birthDate|salary|emergencyContact/i,
      );
    });

    it('omits businessUnit when the company does not use them', async () => {
      const listed = await request(app.getHttpServer())
        .get('/organization/org-chart')
        .set('Authorization', `Bearer ${adminBToken}`)
        .set('X-Company-Id', companyBId)
        .expect(200);
      const body = listed.body as ChartBody;
      for (const node of flatten(body.roots)) {
        expect(node.businessUnit).toBeNull();
      }
    });

    it('hides another tenant chart and rejects missing organization.read', async () => {
      await request(app.getHttpServer())
        .get('/organization/org-chart')
        .set(headersB())
        .expect(200);

      const other = await request(app.getHttpServer())
        .get('/organization/org-chart')
        .set('Authorization', `Bearer ${adminBToken}`)
        .set('X-Company-Id', companyAId)
        .expect(403);
      expect(JSON.stringify(other.body)).not.toContain(companyAId);

      const password = `OrgPass-${suffix}!`;
      const noPerms = await prisma.user.create({
        data: {
          email: `orgchart-noperm-${suffix}@example.com`,
          passwordHash: await hasher.hash(password),
          firstName: 'No',
          lastName: 'Perms',
          status: UserStatus.ACTIVE,
        },
      });
      await prisma.companyMembership.create({
        data: {
          userId: noPerms.id,
          companyId: companyAId,
          status: MembershipStatus.ACTIVE,
        },
      });
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: `orgchart-noperm-${suffix}@example.com`, password })
        .expect(201);

      await request(app.getHttpServer())
        .get('/organization/org-chart')
        .set('Authorization', `Bearer ${(login.body as LoginBody).accessToken}`)
        .set('X-Company-Id', companyAId)
        .expect(403);
    });

    it('defaults to ACTIVE employees and includes inactive when requested', async () => {
      await request(app.getHttpServer())
        .patch(`/organization/employees/${employeeBId}`)
        .set(headersB())
        .send({ status: 'INACTIVE' })
        .expect(200);

      const activeOnly = await request(app.getHttpServer())
        .get('/organization/org-chart')
        .set(headersB())
        .expect(200);
      const activeBody = activeOnly.body as ChartBody;
      expect(activeBody.includeInactive).toBe(false);
      expect(
        flatten(activeBody.roots).some(
          (node) => node.employeeId === employeeBId,
        ),
      ).toBe(false);

      const withInactive = await request(app.getHttpServer())
        .get('/organization/org-chart?includeInactive=true')
        .set(headersB())
        .expect(200);
      const inactiveBody = withInactive.body as ChartBody;
      expect(inactiveBody.includeInactive).toBe(true);
      const inactiveNode = flatten(inactiveBody.roots).find(
        (node) => node.employeeId === employeeBId,
      );
      expect(inactiveNode?.status).toBe('INACTIVE');
      expect(inactiveNode?.businessUnit).toBeNull();
    });
  });
});
