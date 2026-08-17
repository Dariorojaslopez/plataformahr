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
  VacancyApproverType,
  VacancyRequestType,
} from '@prisma/client';
import { join } from 'node:path';
import { loadOptionalEnvFile } from './load-env';
import request, { type Response } from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PasswordHashingService } from '../src/auth/password-hashing.service';
import { VACANCY_APPROVAL_ERRORS } from '../src/ats/ats.constants';

loadOptionalEnvFile(join(__dirname, '../.env'));

describe('ATS vacancy approval workflows (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let hasher: PasswordHashingService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const password = `WfPass-${suffix}!`;

  let companyAId = '';
  let companyBId = '';
  let areaAId = '';
  let positionAId = '';
  let requesterEmployeeId = '';
  let managerEmployeeId = '';
  let otherLeaderEmployeeId = '';
  let companyBEmployeeId = '';
  let orphanEmployeeId = '';
  let managerWithoutUserEmployeeId = '';
  let requesterWithoutUserManagerId = '';

  let adminToken = '';
  let managerToken = '';
  let otherLeaderToken = '';
  let collaboratorToken = '';
  let recruiterToken = '';
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
        name: `WF A ${suffix}`,
        slug: `wf-a-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    const companyB = await prisma.company.create({
      data: {
        name: `WF B ${suffix}`,
        slug: `wf-b-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    companyAId = companyA.id;
    companyBId = companyB.id;

    const areaA = await prisma.area.create({
      data: { companyId: companyAId, name: `WF Area A ${suffix}` },
    });
    const areaB = await prisma.area.create({
      data: { companyId: companyBId, name: `WF Area B ${suffix}` },
    });
    areaAId = areaA.id;

    const positionA = await prisma.position.create({
      data: {
        companyId: companyAId,
        areaId: areaAId,
        name: `WF Dev ${suffix}`,
        headcount: 3,
      },
    });
    positionAId = positionA.id;
    const positionB = await prisma.position.create({
      data: {
        companyId: companyBId,
        areaId: areaB.id,
        name: `WF Dev B ${suffix}`,
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
      `wf-admin-${suffix}@example.com`,
      'CLIENT_ADMIN',
      companyAId,
    );
    const manager = await createUser(
      `wf-manager-${suffix}@example.com`,
      'LEADER',
      companyAId,
    );
    const otherLeader = await createUser(
      `wf-other-${suffix}@example.com`,
      'LEADER',
      companyAId,
    );
    const collaborator = await createUser(
      `wf-collab-${suffix}@example.com`,
      'COLLABORATOR',
      companyAId,
    );
    const recruiter = await createUser(
      `wf-recruiter-${suffix}@example.com`,
      'RECRUITER',
      companyAId,
    );
    const adminB = await createUser(
      `wf-admin-b-${suffix}@example.com`,
      'CLIENT_ADMIN',
      companyBId,
    );

    const requesterEmp = await prisma.employee.create({
      data: {
        companyId: companyAId,
        firstName: 'Requester',
        lastName: 'One',
        email: `wf-req-${suffix}@example.com`,
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
        email: `wf-mgr-${suffix}@example.com`,
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
        email: `wf-oth-${suffix}@example.com`,
        areaId: areaAId,
        positionId: positionAId,
        userId: otherLeader.id,
      },
    });
    otherLeaderEmployeeId = otherLeaderEmp.id;

    await prisma.employee.create({
      data: {
        companyId: companyAId,
        firstName: 'Admin',
        lastName: 'Emp',
        email: `wf-admin-emp-${suffix}@example.com`,
        areaId: areaAId,
        positionId: positionAId,
        userId: admin.id,
      },
    });
    await prisma.employee.create({
      data: {
        companyId: companyAId,
        firstName: 'Recruiter',
        lastName: 'Linked',
        email: `wf-recruiter-emp-${suffix}@example.com`,
        areaId: areaAId,
        positionId: positionAId,
        userId: recruiter.id,
      },
    });

    const companyBEmp = await prisma.employee.create({
      data: {
        companyId: companyBId,
        firstName: 'Other',
        lastName: 'Tenant',
        email: `wf-b-emp-${suffix}@example.com`,
        areaId: areaB.id,
        positionId: positionB.id,
        userId: adminB.id,
      },
    });
    companyBEmployeeId = companyBEmp.id;

    const orphan = await prisma.employee.create({
      data: {
        companyId: companyAId,
        firstName: 'Orphan',
        lastName: 'Emp',
        email: `wf-orphan-${suffix}@example.com`,
        areaId: areaAId,
        positionId: positionAId,
      },
    });
    orphanEmployeeId = orphan.id;

    const managerWithoutUser = await prisma.employee.create({
      data: {
        companyId: companyAId,
        firstName: 'Ghost',
        lastName: 'Manager',
        email: `wf-ghost-${suffix}@example.com`,
        areaId: areaAId,
        positionId: positionAId,
      },
    });
    managerWithoutUserEmployeeId = managerWithoutUser.id;

    const requesterNoUserMgr = await prisma.employee.create({
      data: {
        companyId: companyAId,
        firstName: 'Needs',
        lastName: 'GhostMgr',
        email: `wf-needs-ghost-${suffix}@example.com`,
        areaId: areaAId,
        positionId: positionAId,
      },
    });
    requesterWithoutUserManagerId = requesterNoUserMgr.id;
    await prisma.employeeReportingLine.create({
      data: {
        companyId: companyAId,
        employeeId: requesterWithoutUserManagerId,
        managerEmployeeId: managerWithoutUserEmployeeId,
        type: ReportingLineType.DIRECT,
      },
    });

    await prisma.employeeReportingLine.create({
      data: {
        companyId: companyAId,
        employeeId: requesterEmployeeId,
        managerEmployeeId: managerEmployeeId,
        type: ReportingLineType.DIRECT,
      },
    });

    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(201);
      return (res.body as { accessToken: string }).accessToken;
    };

    adminToken = await login(`wf-admin-${suffix}@example.com`);
    managerToken = await login(`wf-manager-${suffix}@example.com`);
    otherLeaderToken = await login(`wf-other-${suffix}@example.com`);
    collaboratorToken = await login(`wf-collab-${suffix}@example.com`);
    recruiterToken = await login(`wf-recruiter-${suffix}@example.com`);
    adminBToken = await login(`wf-admin-b-${suffix}@example.com`);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const auth = (token: string, companyId = companyAId) => ({
    Authorization: `Bearer ${token}`,
    'X-Company-Id': companyId,
  });

  async function createDraft(requestedByEmployeeId = requesterEmployeeId) {
    const created = await request(app.getHttpServer())
      .post('/ats/vacancy-requests')
      .set(auth(adminToken))
      .send({
        type: VacancyRequestType.EXISTING_POSITION,
        requestedByEmployeeId,
        existingPositionId: positionAId,
        requestedHeadcount: 1,
        justification: `Workflow ${suffix}`,
      })
      .expect(201);
    return (created.body as { id: string }).id;
  }

  async function putWorkflow(
    enabled: boolean,
    steps: Array<Record<string, unknown>>,
    options: { token?: string; companyId?: string; status?: number } = {},
  ): Promise<Response> {
    return request(app.getHttpServer())
      .put('/ats/vacancy-approval-workflow')
      .set(auth(options.token ?? adminToken, options.companyId ?? companyAId))
      .send({ enabled, steps })
      .expect(options.status ?? 200);
  }

  it('returns disabled empty config for companies without a workflow row', async () => {
    const res = await request(app.getHttpServer())
      .get('/ats/vacancy-approval-workflow')
      .set(auth(adminToken))
      .expect(200);
    expect(res.body).toMatchObject({ enabled: false, steps: [] });
    expect(
      (res.body as { allowedRoles: Array<{ code: string }> }).allowedRoles.map(
        (role) => role.code,
      ),
    ).toEqual(expect.arrayContaining(['CLIENT_ADMIN', 'LEADER']));
  });

  it('keeps the legacy manager → HR snapshot when the workflow is disabled', async () => {
    const id = await createDraft();
    const submitted = await request(app.getHttpServer())
      .post(`/ats/vacancy-requests/${id}/submit`)
      .set(auth(adminToken))
      .expect(201);
    const steps = (
      submitted.body as { approvals: Array<{ step: string; sequence: number }> }
    ).approvals.map((item) => item.step);
    expect(steps).toEqual(['DIRECT_MANAGER', 'HR']);
  });

  it('configures, reorders and persists sequential steps', async () => {
    await putWorkflow(true, [
      {
        approverType: VacancyApproverType.ROLE,
        requiredRoleCode: 'CLIENT_ADMIN',
      },
      {
        approverType: VacancyApproverType.MANAGER_OF_REQUESTER,
        label: 'Jefe directo',
      },
    ]);

    const configured = await request(app.getHttpServer())
      .get('/ats/vacancy-approval-workflow')
      .set(auth(adminToken))
      .expect(200);
    expect(configured.body).toMatchObject({
      enabled: true,
      steps: [
        { sequence: 1, approverType: 'ROLE', requiredRoleCode: 'CLIENT_ADMIN' },
        {
          sequence: 2,
          approverType: 'MANAGER_OF_REQUESTER',
          label: 'Jefe directo',
        },
      ],
    });

    await putWorkflow(true, [
      {
        approverType: VacancyApproverType.MANAGER_OF_REQUESTER,
        label: 'Jefe directo',
      },
      {
        approverType: VacancyApproverType.ROLE,
        requiredRoleCode: 'CLIENT_ADMIN',
      },
    ]);

    const reordered = await request(app.getHttpServer())
      .get('/ats/vacancy-approval-workflow')
      .set(auth(adminToken))
      .expect(200);
    expect(
      (reordered.body as { steps: Array<{ approverType: string }> }).steps.map(
        (step) => step.approverType,
      ),
    ).toEqual(['MANAGER_OF_REQUESTER', 'ROLE']);
  });

  it('rejects enabling a workflow without steps and unknown roles', async () => {
    const empty = await putWorkflow(true, [], { status: 400 });
    expect((empty.body as { message: string }).message).toBe(
      VACANCY_APPROVAL_ERRORS.ENABLED_WITHOUT_STEPS,
    );

    const unknown = await putWorkflow(
      true,
      [
        {
          approverType: VacancyApproverType.ROLE,
          requiredRoleCode: 'NOT_A_ROLE',
        },
      ],
      { status: 400 },
    );
    expect((unknown.body as { message: string }).message).toBe(
      VACANCY_APPROVAL_ERRORS.UNKNOWN_ROLE,
    );
  });

  it('rejects cross-tenant employees when configuring a specific approver', async () => {
    const res = await putWorkflow(
      true,
      [
        {
          approverType: VacancyApproverType.SPECIFIC_EMPLOYEE,
          specificEmployeeId: companyBEmployeeId,
        },
      ],
      { status: 404 },
    );
    expect((res.body as { message: string }).message).toBe(
      'Employee not found',
    );
    expect(JSON.stringify(res.body)).not.toContain(companyBId);
    expect(JSON.stringify(res.body)).not.toContain('wf-b-emp-');
  });

  it('does not let company B read or write company A workflow', async () => {
    await request(app.getHttpServer())
      .get('/ats/vacancy-approval-workflow')
      .set(auth(adminBToken, companyBId))
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({ enabled: false, steps: [] });
      });

    await putWorkflow(
      true,
      [
        {
          approverType: VacancyApproverType.ROLE,
          requiredRoleCode: 'CLIENT_ADMIN',
        },
      ],
      { token: adminBToken, companyId: companyBId },
    );

    const companyA = await request(app.getHttpServer())
      .get('/ats/vacancy-approval-workflow')
      .set(auth(adminToken))
      .expect(200);
    expect(
      (companyA.body as { steps: Array<{ approverType: string }> }).steps[0]
        ?.approverType,
    ).toBe('MANAGER_OF_REQUESTER');
  });

  it('resolves the requester manager and fails explicitly when the manager has no user', async () => {
    await putWorkflow(true, [
      { approverType: VacancyApproverType.MANAGER_OF_REQUESTER },
    ]);

    const okId = await createDraft();
    const submitted = await request(app.getHttpServer())
      .post(`/ats/vacancy-requests/${okId}/submit`)
      .set(auth(adminToken))
      .expect(201);
    const approval = (
      submitted.body as {
        approvals: Array<{
          step: string;
          approverEmployeeId: string;
          approverEmployee: { firstName: string; lastName: string };
        }>;
      }
    ).approvals[0];
    expect(approval.step).toBe('DIRECT_MANAGER');
    expect(approval.approverEmployeeId).toBe(managerEmployeeId);
    expect(approval.approverEmployee).toMatchObject({
      firstName: 'Manager',
      lastName: 'Direct',
    });
    expect(JSON.stringify(submitted.body)).not.toContain(companyBId);

    const ghostId = await createDraft(requesterWithoutUserManagerId);
    const failed = await request(app.getHttpServer())
      .post(`/ats/vacancy-requests/${ghostId}/submit`)
      .set(auth(adminToken))
      .expect(400);
    expect((failed.body as { message: string }).message).toBe(
      VACANCY_APPROVAL_ERRORS.MANAGER_NO_USER,
    );
  });

  it('snapshots a specific employee and a role, then isolates later config changes', async () => {
    await putWorkflow(true, [
      {
        approverType: VacancyApproverType.SPECIFIC_EMPLOYEE,
        specificEmployeeId: otherLeaderEmployeeId,
        label: 'Líder de área',
      },
      {
        approverType: VacancyApproverType.ROLE,
        requiredRoleCode: 'CLIENT_ADMIN',
        label: 'RRHH',
      },
    ]);

    const requestA = await createDraft();
    const submittedA = await request(app.getHttpServer())
      .post(`/ats/vacancy-requests/${requestA}/submit`)
      .set(auth(adminToken))
      .expect(201);
    expect(
      (
        submittedA.body as { approvals: Array<{ step: string; label: string }> }
      ).approvals.map((item) => [item.step, item.label]),
    ).toEqual([
      ['SPECIFIC_EMPLOYEE', 'Líder de área'],
      ['ROLE', 'RRHH'],
    ]);

    await putWorkflow(true, [
      {
        approverType: VacancyApproverType.ROLE,
        requiredRoleCode: 'CLIENT_ADMIN',
      },
    ]);

    const stillA = await request(app.getHttpServer())
      .get(`/ats/vacancy-requests/${requestA}`)
      .set(auth(adminToken))
      .expect(200);
    expect(
      (stillA.body as { approvals: Array<{ step: string }> }).approvals.map(
        (item) => item.step,
      ),
    ).toEqual(['SPECIFIC_EMPLOYEE', 'ROLE']);

    const requestB = await createDraft();
    const submittedB = await request(app.getHttpServer())
      .post(`/ats/vacancy-requests/${requestB}/submit`)
      .set(auth(adminToken))
      .expect(201);
    expect(
      (submittedB.body as { approvals: Array<{ step: string }> }).approvals.map(
        (item) => item.step,
      ),
    ).toEqual(['ROLE']);
  });

  it('enforces sequential actors, skip-ahead, rejection, concurrency and my-pending', async () => {
    await putWorkflow(true, [
      { approverType: VacancyApproverType.MANAGER_OF_REQUESTER },
      {
        approverType: VacancyApproverType.ROLE,
        requiredRoleCode: 'CLIENT_ADMIN',
      },
    ]);

    const sequentialId = await createDraft();
    await request(app.getHttpServer())
      .post(`/ats/vacancy-requests/${sequentialId}/submit`)
      .set(auth(adminToken))
      .expect(201);

    await request(app.getHttpServer())
      .post(`/ats/vacancy-requests/${sequentialId}/approve`)
      .set(auth(adminToken))
      .send({})
      .expect(403);

    await request(app.getHttpServer())
      .post(`/ats/vacancy-requests/${sequentialId}/approve`)
      .set(auth(otherLeaderToken))
      .send({})
      .expect(403);

    const afterManager = await request(app.getHttpServer())
      .post(`/ats/vacancy-requests/${sequentialId}/approve`)
      .set(auth(managerToken))
      .send({ comment: 'ok' })
      .expect(201);
    expect((afterManager.body as { status: string }).status).toBe(
      'PENDING_APPROVAL',
    );
    expect(
      (afterManager.body as { currentUserCanDecide: boolean })
        .currentUserCanDecide,
    ).toBe(false);

    await request(app.getHttpServer())
      .post(`/ats/vacancy-requests/${sequentialId}/approve`)
      .set(auth(managerToken))
      .send({})
      .expect(403);

    const final = await request(app.getHttpServer())
      .post(`/ats/vacancy-requests/${sequentialId}/approve`)
      .set(auth(adminToken))
      .send({})
      .expect(201);
    expect((final.body as { status: string }).status).toBe('APPROVED');
    expect((final.body as { vacancy: { id: string } }).vacancy).toBeDefined();

    const rejectId = await createDraft();
    await request(app.getHttpServer())
      .post(`/ats/vacancy-requests/${rejectId}/submit`)
      .set(auth(adminToken))
      .expect(201);
    const rejected = await request(app.getHttpServer())
      .post(`/ats/vacancy-requests/${rejectId}/reject`)
      .set(auth(managerToken))
      .send({ comment: 'No budget' })
      .expect(201);
    expect((rejected.body as { status: string }).status).toBe('REJECTED');
    const rejectedSteps = (
      rejected.body as {
        approvals: Array<{ status: string; comment: string | null }>;
      }
    ).approvals;
    expect(rejectedSteps[0]).toMatchObject({
      status: 'REJECTED',
      comment: 'No budget',
    });
    expect(rejectedSteps[1]?.status).toBe('SKIPPED');

    await request(app.getHttpServer())
      .post(`/ats/vacancy-requests/${rejectId}/approve`)
      .set(auth(adminToken))
      .send({})
      .expect(404);

    const concurrentId = await createDraft();
    await request(app.getHttpServer())
      .post(`/ats/vacancy-requests/${concurrentId}/submit`)
      .set(auth(adminToken))
      .expect(201);
    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post(`/ats/vacancy-requests/${concurrentId}/approve`)
        .set(auth(managerToken))
        .send({}),
      request(app.getHttpServer())
        .post(`/ats/vacancy-requests/${concurrentId}/approve`)
        .set(auth(managerToken))
        .send({}),
    ]);
    const statuses = [first.status, second.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);
    const concurrentRows = await prisma.vacancyApproval.findMany({
      where: { vacancyRequestId: concurrentId },
      orderBy: { sequence: 'asc' },
    });
    expect(
      concurrentRows.filter((row) => row.status === 'APPROVED'),
    ).toHaveLength(1);

    const mineId = await createDraft();
    await request(app.getHttpServer())
      .post(`/ats/vacancy-requests/${mineId}/submit`)
      .set(auth(adminToken))
      .expect(201);
    const mine = await request(app.getHttpServer())
      .get('/ats/vacancy-requests')
      .query({ pendingMyApproval: true })
      .set(auth(managerToken))
      .expect(200);
    expect(
      (mine.body as { items: Array<{ id: string }> }).items.map(
        (item) => item.id,
      ),
    ).toEqual(expect.arrayContaining([mineId]));
    const adminMine = await request(app.getHttpServer())
      .get('/ats/vacancy-requests')
      .query({ pendingMyApproval: true })
      .set(auth(adminToken))
      .expect(200);
    expect(
      (adminMine.body as { items: Array<{ id: string }> }).items.map(
        (item) => item.id,
      ),
    ).not.toEqual(expect.arrayContaining([mineId]));

    const detail = await request(app.getHttpServer())
      .get(`/ats/vacancy-requests/${mineId}`)
      .set(auth(managerToken))
      .expect(200);
    expect(detail.body).toMatchObject({ currentUserCanDecide: true });
    expect(
      (detail.body as { approvals: Array<{ approverEmployee: unknown }> })
        .approvals[0].approverEmployee,
    ).toMatchObject({ firstName: 'Manager', lastName: 'Direct' });
  });

  it('allows a role-only workflow without a direct manager and records audit', async () => {
    await putWorkflow(true, [
      {
        approverType: VacancyApproverType.ROLE,
        requiredRoleCode: 'CLIENT_ADMIN',
      },
    ]);

    const id = await createDraft(orphanEmployeeId);
    const submitted = await request(app.getHttpServer())
      .post(`/ats/vacancy-requests/${id}/submit`)
      .set(auth(adminToken))
      .expect(201);
    expect(
      (submitted.body as { approvals: Array<{ step: string }> }).approvals,
    ).toHaveLength(1);

    await request(app.getHttpServer())
      .post(`/ats/vacancy-requests/${id}/approve`)
      .set(auth(recruiterToken))
      .send({})
      .expect(403);

    await request(app.getHttpServer())
      .put('/ats/vacancy-approval-workflow')
      .set(auth(collaboratorToken))
      .send({
        enabled: true,
        steps: [
          {
            approverType: VacancyApproverType.ROLE,
            requiredRoleCode: 'CLIENT_ADMIN',
          },
        ],
      })
      .expect(403);

    const logs = await prisma.auditLog.findMany({
      where: {
        companyId: companyAId,
        action: {
          in: [
            'VACANCY_APPROVAL_WORKFLOW_UPDATED',
            'VACANCY_REQUEST_SUBMITTED',
            'VACANCY_REQUEST_APPROVED_STEP',
            'VACANCY_REQUEST_APPROVED',
            'VACANCY_REQUEST_REJECTED',
          ],
        },
      },
    });
    expect(
      logs.some((log) => log.action === 'VACANCY_APPROVAL_WORKFLOW_UPDATED'),
    ).toBe(true);
    expect(logs.some((log) => log.action === 'VACANCY_REQUEST_SUBMITTED')).toBe(
      true,
    );
    expect(logs.some((log) => log.action === 'VACANCY_REQUEST_REJECTED')).toBe(
      true,
    );
  });
});
