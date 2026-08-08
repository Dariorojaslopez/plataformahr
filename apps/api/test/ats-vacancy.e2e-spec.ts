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
  VacancyRequestType,
  VacancyStatus,
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

describe('ATS vacancy core (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let hasher: PasswordHashingService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const password = `AtsPass-${suffix}!`;

  let companyAId = '';
  let companyBId = '';
  let areaAId = '';
  let areaBId = '';
  let positionAId = '';
  let positionHeadcountStart = 0;
  let requesterEmployeeId = '';
  let managerEmployeeId = '';
  let otherLeaderEmployeeId = '';

  let adminToken = '';
  let managerToken = '';
  let otherLeaderToken = '';
  let collaboratorToken = '';
  let adminBToken = '';

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
        name: `ATS A ${suffix}`,
        slug: `ats-a-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    const companyB = await prisma.company.create({
      data: {
        name: `ATS B ${suffix}`,
        slug: `ats-b-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    companyAId = companyA.id;
    companyBId = companyB.id;

    const areaA = await prisma.area.create({
      data: { companyId: companyAId, name: `ATS Area A ${suffix}` },
    });
    const areaB = await prisma.area.create({
      data: { companyId: companyBId, name: `ATS Area B ${suffix}` },
    });
    areaAId = areaA.id;
    areaBId = areaB.id;

    const positionA = await prisma.position.create({
      data: {
        companyId: companyAId,
        areaId: areaAId,
        name: `Dev ${suffix}`,
        headcount: 5,
      },
    });
    positionAId = positionA.id;
    positionHeadcountStart = positionA.headcount;

    await prisma.position.create({
      data: {
        companyId: companyBId,
        areaId: areaBId,
        name: `Dev B ${suffix}`,
        headcount: 1,
      },
    });

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
          firstName: 'User',
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

    const admin = await createUser(
      `ats-admin-${suffix}@example.com`,
      'CLIENT_ADMIN',
      companyAId,
    );
    const manager = await createUser(
      `ats-manager-${suffix}@example.com`,
      'LEADER',
      companyAId,
    );
    const otherLeader = await createUser(
      `ats-other-${suffix}@example.com`,
      'LEADER',
      companyAId,
    );
    const collaborator = await createUser(
      `ats-collab-${suffix}@example.com`,
      'COLLABORATOR',
      companyAId,
    );
    await createUser(
      `ats-admin-b-${suffix}@example.com`,
      'CLIENT_ADMIN',
      companyBId,
    );

    const requesterEmp = await prisma.employee.create({
      data: {
        companyId: companyAId,
        firstName: 'Requester',
        lastName: 'One',
        email: `req-${suffix}@example.com`,
        areaId: areaAId,
        positionId: positionAId,
        userId: collaborator.id,
      },
    });
    requesterEmployeeId = requesterEmp.id;

    const managerEmp = await prisma.employee.create({
      data: {
        companyId: companyAId,
        firstName: 'Manager',
        lastName: 'Direct',
        email: `mgr-${suffix}@example.com`,
        areaId: areaAId,
        positionId: positionAId,
        userId: manager.id,
      },
    });
    managerEmployeeId = managerEmp.id;

    const otherLeaderEmp = await prisma.employee.create({
      data: {
        companyId: companyAId,
        firstName: 'Other',
        lastName: 'Leader',
        email: `oth-${suffix}@example.com`,
        areaId: areaAId,
        positionId: positionAId,
        userId: otherLeader.id,
      },
    });
    otherLeaderEmployeeId = otherLeaderEmp.id;

    await prisma.employeeReportingLine.create({
      data: {
        companyId: companyAId,
        employeeId: requesterEmployeeId,
        managerEmployeeId: managerEmployeeId,
        type: ReportingLineType.DIRECT,
      },
    });

    // Admin also needs an employee for optional GM flows; not required as requester.
    await prisma.employee.create({
      data: {
        companyId: companyAId,
        firstName: 'Admin',
        lastName: 'Emp',
        email: `admin-emp-${suffix}@example.com`,
        areaId: areaAId,
        positionId: positionAId,
        userId: admin.id,
      },
    });

    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(201);
      return (res.body as { accessToken: string }).accessToken;
    };

    adminToken = await login(`ats-admin-${suffix}@example.com`);
    managerToken = await login(`ats-manager-${suffix}@example.com`);
    otherLeaderToken = await login(`ats-other-${suffix}@example.com`);
    collaboratorToken = await login(`ats-collab-${suffix}@example.com`);
    adminBToken = await login(`ats-admin-b-${suffix}@example.com`);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const auth = (token: string, companyId = companyAId) => ({
    Authorization: `Bearer ${token}`,
    'X-Company-Id': companyId,
  });

  it('creates and edits DRAFT, rejects edit when pending', async () => {
    const created = await request(app.getHttpServer())
      .post('/ats/vacancy-requests')
      .set(auth(adminToken))
      .send({
        type: VacancyRequestType.EXISTING_POSITION,
        requestedByEmployeeId: requesterEmployeeId,
        existingPositionId: positionAId,
        requestedHeadcount: 2,
        justification: 'Need more developers',
      })
      .expect(201);

    const id = (created.body as { id: string }).id;
    expect((created.body as { status: string }).status).toBe('DRAFT');

    await request(app.getHttpServer())
      .patch(`/ats/vacancy-requests/${id}`)
      .set(auth(adminToken))
      .send({ requestedHeadcount: 3 })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/ats/vacancy-requests/${id}/submit`)
      .set(auth(adminToken))
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/ats/vacancy-requests/${id}`)
      .set(auth(adminToken))
      .send({ requestedHeadcount: 4 })
      .expect(400);
  });

  it('submit without direct manager fails', async () => {
    const orphan = await prisma.employee.create({
      data: {
        companyId: companyAId,
        firstName: 'Orphan',
        lastName: 'Emp',
        email: `orphan-${suffix}@example.com`,
        areaId: areaAId,
        positionId: positionAId,
      },
    });

    const created = await request(app.getHttpServer())
      .post('/ats/vacancy-requests')
      .set(auth(adminToken))
      .send({
        type: VacancyRequestType.EXISTING_POSITION,
        requestedByEmployeeId: orphan.id,
        existingPositionId: positionAId,
        requestedHeadcount: 1,
        justification: 'No manager',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/ats/vacancy-requests/${(created.body as { id: string }).id}/submit`,
      )
      .set(auth(adminToken))
      .expect(400);
  });

  it('creates GENERAL_MANAGER step only when required', async () => {
    const withoutGm = await request(app.getHttpServer())
      .post('/ats/vacancy-requests')
      .set(auth(adminToken))
      .send({
        type: VacancyRequestType.EXISTING_POSITION,
        requestedByEmployeeId: requesterEmployeeId,
        existingPositionId: positionAId,
        requestedHeadcount: 1,
        justification: 'No GM',
        generalManagerApprovalRequired: false,
      })
      .expect(201);
    const submitted = await request(app.getHttpServer())
      .post(
        `/ats/vacancy-requests/${(withoutGm.body as { id: string }).id}/submit`,
      )
      .set(auth(adminToken))
      .expect(201);
    const steps = (
      submitted.body as { approvals: Array<{ step: string }> }
    ).approvals.map((a) => a.step);
    expect(steps).toEqual(['DIRECT_MANAGER', 'HR']);

    const withGm = await request(app.getHttpServer())
      .post('/ats/vacancy-requests')
      .set(auth(adminToken))
      .send({
        type: VacancyRequestType.EXISTING_POSITION,
        requestedByEmployeeId: requesterEmployeeId,
        existingPositionId: positionAId,
        requestedHeadcount: 1,
        justification: 'Needs GM',
        generalManagerApprovalRequired: true,
      })
      .expect(201);
    const submittedGm = await request(app.getHttpServer())
      .post(
        `/ats/vacancy-requests/${(withGm.body as { id: string }).id}/submit`,
      )
      .set(auth(adminToken))
      .expect(201);
    expect(
      (
        submittedGm.body as { approvals: Array<{ step: string }> }
      ).approvals.map((a) => a.step),
    ).toEqual(['DIRECT_MANAGER', 'HR', 'GENERAL_MANAGER']);
  });

  it('enforces approval order, actor rules, rejection and full approval headcount', async () => {
    const created = await request(app.getHttpServer())
      .post('/ats/vacancy-requests')
      .set(auth(adminToken))
      .send({
        type: VacancyRequestType.EXISTING_POSITION,
        requestedByEmployeeId: requesterEmployeeId,
        existingPositionId: positionAId,
        requestedHeadcount: 2,
        justification: 'Full flow',
      })
      .expect(201);
    const id = (created.body as { id: string }).id;

    await request(app.getHttpServer())
      .post(`/ats/vacancy-requests/${id}/submit`)
      .set(auth(adminToken))
      .expect(201);

    // HR cannot skip ahead of DIRECT_MANAGER
    await request(app.getHttpServer())
      .post(`/ats/vacancy-requests/${id}/approve`)
      .set(auth(adminToken))
      .send({})
      .expect(403);

    // Other leader cannot approve DIRECT_MANAGER
    await request(app.getHttpServer())
      .post(`/ats/vacancy-requests/${id}/approve`)
      .set(auth(otherLeaderToken))
      .send({})
      .expect(403);

    await request(app.getHttpServer())
      .post(`/ats/vacancy-requests/${id}/approve`)
      .set(auth(managerToken))
      .send({ comment: 'ok' })
      .expect(201);

    // Collaborator lacks CLIENT_ADMIN role for HR
    await request(app.getHttpServer())
      .post(`/ats/vacancy-requests/${id}/approve`)
      .set(auth(collaboratorToken))
      .send({})
      .expect(403);

    // Leader without CLIENT_ADMIN cannot approve HR
    await request(app.getHttpServer())
      .post(`/ats/vacancy-requests/${id}/approve`)
      .set(auth(managerToken))
      .send({})
      .expect(403);

    const before = await prisma.position.findUniqueOrThrow({
      where: { id: positionAId },
    });

    const final = await request(app.getHttpServer())
      .post(`/ats/vacancy-requests/${id}/approve`)
      .set(auth(adminToken))
      .send({})
      .expect(201);

    expect((final.body as { status: string }).status).toBe('APPROVED');
    expect((final.body as { vacancy: { id: string } }).vacancy).toBeDefined();

    const after = await prisma.position.findUniqueOrThrow({
      where: { id: positionAId },
    });
    expect(after.headcount).toBe(before.headcount + 2);

    const vacancies = await prisma.vacancy.findMany({
      where: { vacancyRequestId: id },
    });
    expect(vacancies).toHaveLength(1);
    expect(vacancies[0]?.headcount).toBe(2);
    expect(vacancies[0]?.filledCount).toBe(0);

    // Double approval idempotency: cannot approve again
    await request(app.getHttpServer())
      .post(`/ats/vacancy-requests/${id}/approve`)
      .set(auth(adminToken))
      .send({})
      .expect(404);
  });

  it('rejects request and stops workflow', async () => {
    const created = await request(app.getHttpServer())
      .post('/ats/vacancy-requests')
      .set(auth(adminToken))
      .send({
        type: VacancyRequestType.EXISTING_POSITION,
        requestedByEmployeeId: requesterEmployeeId,
        existingPositionId: positionAId,
        requestedHeadcount: 1,
        justification: 'Reject me',
      })
      .expect(201);
    const id = (created.body as { id: string }).id;
    await request(app.getHttpServer())
      .post(`/ats/vacancy-requests/${id}/submit`)
      .set(auth(adminToken))
      .expect(201);

    await request(app.getHttpServer())
      .post(`/ats/vacancy-requests/${id}/reject`)
      .set(auth(managerToken))
      .send({ comment: 'Not needed' })
      .expect(201);

    const requestRow = await prisma.vacancyRequest.findUniqueOrThrow({
      where: { id },
    });
    expect(requestRow.status).toBe('REJECTED');
    expect(
      await prisma.vacancy.count({ where: { vacancyRequestId: id } }),
    ).toBe(0);
  });

  it('creates NEW_POSITION with correct headcount and rejects cross-tenant refs', async () => {
    const created = await request(app.getHttpServer())
      .post('/ats/vacancy-requests')
      .set(auth(adminToken))
      .send({
        type: VacancyRequestType.NEW_POSITION,
        requestedByEmployeeId: requesterEmployeeId,
        requestedPositionName: `New Role ${suffix}`,
        requestedAreaId: areaAId,
        requestedHeadcount: 3,
        justification: 'New role needed',
      })
      .expect(201);
    const id = (created.body as { id: string }).id;
    await request(app.getHttpServer())
      .post(`/ats/vacancy-requests/${id}/submit`)
      .set(auth(adminToken))
      .expect(201);
    await request(app.getHttpServer())
      .post(`/ats/vacancy-requests/${id}/approve`)
      .set(auth(managerToken))
      .send({})
      .expect(201);
    const approved = await request(app.getHttpServer())
      .post(`/ats/vacancy-requests/${id}/approve`)
      .set(auth(adminToken))
      .send({})
      .expect(201);

    const vacancyId = (
      approved.body as { vacancy: { id: string; positionId: string } }
    ).vacancy.id;
    const vacancy = await prisma.vacancy.findUniqueOrThrow({
      where: { id: vacancyId },
      include: { position: true },
    });
    expect(vacancy.headcount).toBe(3);
    expect(vacancy.position.headcount).toBe(3);
    expect(vacancy.position.name).toBe(`New Role ${suffix}`);

    await request(app.getHttpServer())
      .post('/ats/vacancy-requests')
      .set(auth(adminToken))
      .send({
        type: VacancyRequestType.EXISTING_POSITION,
        requestedByEmployeeId: requesterEmployeeId,
        existingPositionId: (
          await prisma.position.findFirstOrThrow({
            where: { companyId: companyBId },
          })
        ).id,
        requestedHeadcount: 1,
        justification: 'Cross tenant',
      })
      .expect(404);

    await request(app.getHttpServer())
      .post('/ats/vacancy-requests')
      .set(auth(adminToken))
      .send({
        type: VacancyRequestType.NEW_POSITION,
        requestedByEmployeeId: requesterEmployeeId,
        requestedPositionName: `Cross Area ${suffix}`,
        requestedAreaId: areaBId,
        requestedHeadcount: 1,
        justification: 'Cross area',
      })
      .expect(404);
  });

  it('enforces vacancy transitions, permissions, pagination and tenant search', async () => {
    const vacancy = await prisma.vacancy.findFirstOrThrow({
      where: { companyId: companyAId, deletedAt: null },
    });

    await request(app.getHttpServer()).get('/ats/vacancies').expect(401);

    await request(app.getHttpServer())
      .patch(`/ats/vacancies/${vacancy.id}`)
      .set(auth(collaboratorToken))
      .send({ status: VacancyStatus.PAUSED })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/ats/vacancies/${vacancy.id}`)
      .set(auth(adminToken))
      .send({ status: VacancyStatus.PAUSED })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/ats/vacancies/${vacancy.id}`)
      .set(auth(adminToken))
      .send({ status: VacancyStatus.OPEN })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/ats/vacancies/${vacancy.id}`)
      .set(auth(adminToken))
      .send({ status: VacancyStatus.CLOSED })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/ats/vacancies/${vacancy.id}`)
      .set(auth(adminToken))
      .send({ status: VacancyStatus.OPEN })
      .expect(400);

    const page = await request(app.getHttpServer())
      .get('/ats/vacancy-requests')
      .query({ page: 1, limit: 2, search: 'Dev' })
      .set(auth(adminToken))
      .expect(200);
    expect((page.body as { limit: number }).limit).toBe(2);
    expect(JSON.stringify(page.body)).not.toContain(companyBId);

    await request(app.getHttpServer())
      .get(`/ats/vacancies/${vacancy.id}`)
      .set(auth(adminBToken, companyBId))
      .expect(404);
  });

  it('records audit events for submit and approval', async () => {
    const logs = await prisma.auditLog.findMany({
      where: {
        companyId: companyAId,
        action: {
          in: [
            'VACANCY_REQUEST_SUBMITTED',
            'VACANCY_REQUEST_APPROVED',
            'VACANCY_CREATED',
            'VACANCY_STATUS_CHANGED',
          ],
        },
      },
    });
    expect(logs.length).toBeGreaterThan(0);
  });

  // silence unused vars in strict builds
  void otherLeaderEmployeeId;
  void positionHeadcountStart;
});
