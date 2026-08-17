import { INestApplication } from '@nestjs/common';
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
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PasswordHashingService } from '../src/auth/password-hashing.service';
import { configureApp } from '../src/config/configure-app';
import { validateSecurityEnv } from '../src/config/security.config';
import { ORG_IMPORT_HEADERS } from '../src/organization/import/import.constants';
import { loadOptionalEnvFile } from './load-env';

loadOptionalEnvFile(join(__dirname, '../.env'));

type LoginBody = { accessToken: string };

type ImportBody = {
  canApply?: boolean;
  applied?: boolean;
  summary?: {
    employees: { create: number };
    areas: { create: number; update: number };
    reportingLines: { create: number };
  };
  issues?: unknown;
};

function csv(
  rows: Array<Partial<Record<(typeof ORG_IMPORT_HEADERS)[number], string>>>,
): string {
  const header = ORG_IMPORT_HEADERS.join(',');
  const lines = rows.map((row) =>
    ORG_IMPORT_HEADERS.map((key) => {
      const value = row[key] ?? '';
      return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
    }).join(','),
  );
  return `${header}\n${lines.join('\n')}\n`;
}

describe('Organization import (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let companyAId = '';
  let companyBId = '';
  let adminAToken = '';
  let adminBToken = '';
  let readerToken = '';

  const headersA = () => ({
    Authorization: `Bearer ${adminAToken}`,
    'X-Company-Id': companyAId,
    'Content-Type': 'text/csv',
  });
  const headersB = () => ({
    Authorization: `Bearer ${adminBToken}`,
    'X-Company-Id': companyBId,
    'Content-Type': 'text/csv',
  });

  beforeAll(async () => {
    prisma = new PrismaClient();
    const hasher = new PasswordHashingService();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureApp(app, { security: validateSecurityEnv(process.env) });
    await app.init();

    const companyA = await prisma.company.create({
      data: {
        name: `Imp A ${suffix}`,
        slug: `imp-a-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    const companyB = await prisma.company.create({
      data: {
        name: `Imp B ${suffix}`,
        slug: `imp-b-${suffix}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    companyAId = companyA.id;
    companyBId = companyB.id;

    const password = `ImpPass-${suffix}!`;
    const passwordHash = await hasher.hash(password);
    const roleAdmin = await prisma.role.findUniqueOrThrow({
      where: { scope_code: { scope: RoleScope.COMPANY, code: 'CLIENT_ADMIN' } },
    });
    const roleCollab = await prisma.role.findUniqueOrThrow({
      where: { scope_code: { scope: RoleScope.COMPANY, code: 'COLLABORATOR' } },
    });

    const adminA = await prisma.user.create({
      data: {
        email: `imp-admin-a-${suffix}@example.com`,
        passwordHash,
        firstName: 'Admin',
        lastName: 'A',
        status: UserStatus.ACTIVE,
      },
    });
    const adminB = await prisma.user.create({
      data: {
        email: `imp-admin-b-${suffix}@example.com`,
        passwordHash,
        firstName: 'Admin',
        lastName: 'B',
        status: UserStatus.ACTIVE,
      },
    });
    const reader = await prisma.user.create({
      data: {
        email: `imp-reader-${suffix}@example.com`,
        passwordHash,
        firstName: 'Reader',
        lastName: 'A',
        status: UserStatus.ACTIVE,
      },
    });

    for (const [userId, companyId, roleId] of [
      [adminA.id, companyA.id, roleAdmin.id],
      [adminB.id, companyB.id, roleAdmin.id],
      [reader.id, companyA.id, roleCollab.id],
    ] as const) {
      const membership = await prisma.companyMembership.create({
        data: { userId, companyId, status: MembershipStatus.ACTIVE },
      });
      await prisma.membershipRole.create({
        data: { membershipId: membership.id, roleId },
      });
    }

    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(201);
      return (res.body as LoginBody).accessToken;
    };
    adminAToken = await login(`imp-admin-a-${suffix}@example.com`);
    adminBToken = await login(`imp-admin-b-${suffix}@example.com`);
    readerToken = await login(`imp-reader-${suffix}@example.com`);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const validRows = (tag: string) => {
    const rank = String(
      [...tag].reduce((sum, char) => sum + char.charCodeAt(0), 0),
    );
    return [
      { recordType: 'jobLevel', code: `JL-${tag}`, name: `Nivel ${tag}`, rank },
      { recordType: 'area', code: `AR-${tag}`, name: `Area ${tag}` },
      {
        recordType: 'position',
        code: `PO-${tag}`,
        name: `Cargo ${tag}`,
        areaCode: `AR-${tag}`,
        jobLevelCode: `JL-${tag}`,
      },
      {
        recordType: 'employee',
        email: `root-${tag}@example.com`,
        firstName: 'Root',
        lastName: tag,
        areaCode: `AR-${tag}`,
        positionCode: `PO-${tag}`,
      },
      {
        recordType: 'employee',
        email: `leaf-${tag}@example.com`,
        firstName: 'Leaf',
        lastName: tag,
        areaCode: `AR-${tag}`,
        positionCode: `PO-${tag}`,
        managerEmail: `root-${tag}@example.com`,
      },
    ];
  };

  it('downloads a UTF-8 CSV template', async () => {
    const res = await request(app.getHttpServer())
      .get('/organization/import/template')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .expect(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(String(res.text)).toContain('recordType');
    expect(String(res.text)).toContain('managerEmail');
  });

  it('previews a valid file without writing', async () => {
    const before = await prisma.area.count({
      where: { companyId: companyAId },
    });
    const res = await request(app.getHttpServer())
      .post('/organization/import/preview')
      .set(headersA())
      .send(csv(validRows(`pv-${suffix}`)))
      .expect(200);
    expect((res.body as ImportBody).canApply).toBe(true);
    expect((res.body as ImportBody).summary?.employees.create).toBe(2);
    const after = await prisma.area.count({ where: { companyId: companyAId } });
    expect(after).toBe(before);
  });

  it('applies a full import including manager-after-collaborator', async () => {
    const tag = `ok-${suffix}`;
    const res = await request(app.getHttpServer())
      .post('/organization/import/apply')
      .set(headersA())
      .send(csv(validRows(tag)))
      .expect(201);
    expect((res.body as ImportBody).applied).toBe(true);
    expect((res.body as ImportBody).summary?.areas.create).toBe(1);
    expect((res.body as ImportBody).summary?.reportingLines.create).toBe(1);

    const area = await prisma.area.findFirst({
      where: { companyId: companyAId, code: `AR-${tag}` },
    });
    expect(area?.businessUnitId).toBeNull();
    const leaf = await prisma.employee.findFirst({
      where: { companyId: companyAId, email: `leaf-${tag}@example.com` },
    });
    const line = await prisma.employeeReportingLine.findFirst({
      where: { employeeId: leaf?.id },
    });
    expect(line?.type).toBe('DIRECT');

    const audit = await prisma.auditLog.findFirst({
      where: { companyId: companyAId, action: 'ORGANIZATION_IMPORTED' },
    });
    expect(audit).toBeTruthy();
  });

  it('updates existing structure on a second apply', async () => {
    const tag = `ok-${suffix}`;
    const res = await request(app.getHttpServer())
      .post('/organization/import/apply')
      .set(headersA())
      .send(
        csv([
          {
            recordType: 'area',
            code: `AR-${tag}`,
            name: `Area ${tag} 2`,
          },
        ]),
      )
      .expect(201);
    expect((res.body as ImportBody).summary?.areas.update).toBe(1);
    const area = await prisma.area.findFirst({
      where: { companyId: companyAId, code: `AR-${tag}` },
    });
    expect(area?.name).toBe(`Area ${tag} 2`);
  });

  it('rejects apply with row errors and does not write', async () => {
    const before = await prisma.businessUnit.count({
      where: { companyId: companyAId },
    });
    const res = await request(app.getHttpServer())
      .post('/organization/import/apply')
      .set(headersA())
      .send(
        csv([
          { recordType: 'businessUnit', code: 'BU-FAIL', name: 'Temp' },
          {
            recordType: 'employee',
            email: 'bad',
            firstName: 'X',
            lastName: 'Y',
            areaCode: 'NOPE',
            positionCode: 'NOPE',
          },
        ]),
      )
      .expect(400);
    expect((res.body as ImportBody).applied).toBe(false);
    expect(JSON.stringify((res.body as ImportBody).issues)).toMatch(
      /Email inválido|No existe/,
    );
    const after = await prisma.businessUnit.count({
      where: { companyId: companyAId },
    });
    expect(after).toBe(before);
    expect(
      await prisma.businessUnit.findFirst({
        where: { companyId: companyAId, code: 'BU-FAIL' },
      }),
    ).toBeNull();
  });

  it('rejects invalid format, 403 without manage, and cross-tenant codes', async () => {
    await request(app.getHttpServer())
      .post('/organization/import/preview')
      .set(headersA())
      .send('"broken')
      .expect(200)
      .expect((res) => {
        expect((res.body as ImportBody).canApply).toBe(false);
      });

    await request(app.getHttpServer())
      .post('/organization/import/preview')
      .set('Authorization', `Bearer ${readerToken}`)
      .set('X-Company-Id', companyAId)
      .set('Content-Type', 'text/csv')
      .send(csv(validRows('nope')))
      .expect(403);

    await request(app.getHttpServer())
      .post('/organization/import/apply')
      .set('Authorization', `Bearer ${adminBToken}`)
      .set('X-Company-Id', companyAId)
      .set('Content-Type', 'text/csv')
      .send(csv(validRows('x')))
      .expect(403);

    const previewB = await request(app.getHttpServer())
      .post('/organization/import/preview')
      .set(headersB())
      .send(
        csv([
          {
            recordType: 'position',
            code: 'PO-X',
            name: 'X',
            areaCode: `AR-ok-${suffix}`,
          },
        ]),
      )
      .expect(200);
    expect((previewB.body as ImportBody).canApply).toBe(false);
    expect(JSON.stringify((previewB.body as ImportBody).issues)).toContain(
      'No existe el área',
    );
  });

  it('keeps a single winner when two applies race on the same new codes', async () => {
    const tag = `race-${suffix}`;
    const body = csv(validRows(tag));
    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/organization/import/apply')
        .set(headersA())
        .send(body),
      request(app.getHttpServer())
        .post('/organization/import/apply')
        .set(headersA())
        .send(body),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses[0] === 201 || statuses[1] === 201).toBe(true);
    const areas = await prisma.area.count({
      where: { companyId: companyAId, code: `AR-${tag}` },
    });
    expect(areas).toBe(1);
  });
});
