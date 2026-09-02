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
import ExcelJS from 'exceljs';
import { join } from 'node:path';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PasswordHashingService } from '../src/auth/password-hashing.service';
import { configureApp } from '../src/config/configure-app';
import { validateSecurityEnv } from '../src/config/security.config';
import {
  ORG_IMPORT_HEADERS,
  XLSX_MIME,
} from '../src/organization/import/import.constants';
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

async function xlsxFromRows(
  rows: Array<Partial<Record<(typeof ORG_IMPORT_HEADERS)[number], string>>>,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Datos');
  sheet.addRow([...ORG_IMPORT_HEADERS]);
  for (const row of rows) {
    sheet.addRow(ORG_IMPORT_HEADERS.map((key) => row[key] ?? ''));
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
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
      { recordType: 'jobLevel', name: `Nivel ${tag}`, rank },
      { recordType: 'area', name: `Area ${tag}` },
      {
        recordType: 'position',
        name: `Cargo ${tag}`,
        areaName: `Area ${tag}`,
        jobLevelName: `Nivel ${tag}`,
      },
      {
        recordType: 'employee',
        email: `root-${tag}@example.com`,
        firstName: 'Root',
        lastName: tag,
        areaName: `Area ${tag}`,
        positionName: `Cargo ${tag}`,
      },
      {
        recordType: 'employee',
        email: `leaf-${tag}@example.com`,
        firstName: 'Leaf',
        lastName: tag,
        areaName: `Area ${tag}`,
        positionName: `Cargo ${tag}`,
        managerEmail: `root-${tag}@example.com`,
      },
    ];
  };

  it('downloads an xlsx template by default and CSV on demand', async () => {
    const xlsxRes = await request(app.getHttpServer())
      .get('/organization/import/template')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(xlsxRes.headers['content-type']).toMatch(/spreadsheetml/);
    expect(xlsxRes.headers['content-disposition']).toMatch(
      /plantilla-organizacion\.xlsx/,
    );
    expect((xlsxRes.body as Buffer).subarray(0, 2).toString()).toBe('PK');

    const csvRes = await request(app.getHttpServer())
      .get('/organization/import/template?format=csv')
      .set('Authorization', `Bearer ${adminAToken}`)
      .set('X-Company-Id', companyAId)
      .expect(200);
    expect(csvRes.headers['content-type']).toMatch(/text\/csv/);
    const csvHeader = String(csvRes.text).split('\n')[0] ?? '';
    expect(csvHeader).toContain('recordType');
    expect(csvHeader).toContain('managerEmail');
    expect(csvHeader.split(',')).not.toContain('code');
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

  it('previews a valid xlsx without writing', async () => {
    const before = await prisma.area.count({
      where: { companyId: companyAId },
    });
    const res = await request(app.getHttpServer())
      .post('/organization/import/preview')
      .set({
        Authorization: `Bearer ${adminAToken}`,
        'X-Company-Id': companyAId,
        'Content-Type': XLSX_MIME,
      })
      .send(await xlsxFromRows(validRows(`xl-${suffix}`)))
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
      where: { companyId: companyAId, name: `Area ${tag}` },
    });
    expect(area?.businessUnitId).toBeNull();
    expect(area?.code).toMatch(/^\d+$/);
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
            name: `Area ${tag}`,
            description: 'Actualizada',
          },
        ]),
      )
      .expect(201);
    expect((res.body as ImportBody).summary?.areas.update).toBe(1);
    const area = await prisma.area.findFirst({
      where: { companyId: companyAId, name: `Area ${tag}` },
    });
    expect(area?.description).toBe('Actualizada');
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
          { recordType: 'businessUnit', name: 'Temp' },
          {
            recordType: 'employee',
            email: 'bad',
            firstName: 'X',
            lastName: 'Y',
            areaName: 'NOPE',
            positionName: 'NOPE',
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
        where: { companyId: companyAId, name: 'Temp' },
      }),
    ).toBeNull();
  });

  it('rejects invalid format, 403 without manage, and cross-tenant names', async () => {
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
            name: 'X',
            areaName: `Area ok-${suffix}`,
          },
        ]),
      )
      .expect(200);
    expect((previewB.body as ImportBody).canApply).toBe(false);
    expect(JSON.stringify((previewB.body as ImportBody).issues)).toContain(
      'No existe el área',
    );
  });

  it('keeps a single winner when two applies race on the same new names', async () => {
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
      where: { companyId: companyAId, name: `Area ${tag}` },
    });
    expect(areas).toBe(1);
  });
});
