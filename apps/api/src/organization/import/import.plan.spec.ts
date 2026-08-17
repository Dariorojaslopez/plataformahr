import { EmployeeStatus } from '@prisma/client';
import { buildCsvDocument } from '../../performance/csv-export';
import { ORG_IMPORT_HEADERS, ORG_IMPORT_MAX_ROWS } from './import.constants';
import { buildOrgImportPlan } from './import.plan';
import { emptyCatalog } from './import.types';

function csv(
  rows: Array<Partial<Record<(typeof ORG_IMPORT_HEADERS)[number], string>>>,
): string {
  return buildCsvDocument({
    headers: [...ORG_IMPORT_HEADERS],
    rows: rows.map((row) =>
      ORG_IMPORT_HEADERS.map((header) => row[header] ?? ''),
    ),
  });
}

describe('buildOrgImportPlan', () => {
  it('previews a valid company without business units', () => {
    const plan = buildOrgImportPlan(
      csv([
        {
          recordType: 'jobLevel',
          code: 'JL1',
          name: 'Junior',
          rank: '1',
        },
        {
          recordType: 'area',
          code: 'OPS',
          name: 'Operaciones',
        },
        {
          recordType: 'position',
          code: 'ANL',
          name: 'Analista',
          areaCode: 'OPS',
          jobLevelCode: 'JL1',
        },
        {
          recordType: 'employee',
          email: 'ada@example.com',
          firstName: 'Ada',
          lastName: 'Lovelace',
          areaCode: 'OPS',
          positionCode: 'ANL',
        },
      ]),
      emptyCatalog(),
    );
    expect(plan.canApply).toBe(true);
    expect(plan.issues.filter((item) => item.level === 'error')).toEqual([]);
    expect(plan.summary.businessUnits.create).toBe(0);
    expect(plan.summary.areas.create).toBe(1);
    expect(plan.summary.employees.create).toBe(1);
  });

  it('creates a full structure and a manager defined after the collaborator', () => {
    const plan = buildOrgImportPlan(
      csv([
        { recordType: 'businessUnit', code: 'BU1', name: 'Comercial' },
        { recordType: 'jobLevel', code: 'JL1', name: 'Junior', rank: '1' },
        {
          recordType: 'area',
          code: 'OPS',
          name: 'Operaciones',
          businessUnitCode: 'BU1',
        },
        {
          recordType: 'position',
          code: 'ANL',
          name: 'Analista',
          areaCode: 'OPS',
          jobLevelCode: 'JL1',
        },
        {
          recordType: 'employee',
          email: 'luis@example.com',
          firstName: 'Luis',
          lastName: 'Reporte',
          areaCode: 'OPS',
          positionCode: 'ANL',
          managerEmail: 'ana@example.com',
        },
        {
          recordType: 'employee',
          email: 'ana@example.com',
          firstName: 'Ana',
          lastName: 'Jefe',
          areaCode: 'OPS',
          positionCode: 'ANL',
        },
      ]),
      emptyCatalog(),
    );
    expect(plan.canApply).toBe(true);
    expect(plan.reportingLines[0]?.managerEmail).toBe('ana@example.com');
    expect(plan.summary.reportingLines.create).toBe(1);
  });

  it('updates existing records matched by code or email', () => {
    const plan = buildOrgImportPlan(
      csv([
        { recordType: 'businessUnit', code: 'BU1', name: 'Comercial Norte' },
        {
          recordType: 'employee',
          email: 'ada@example.com',
          firstName: 'Ada',
          lastName: 'Updated',
          areaCode: 'OPS',
          positionCode: 'ANL',
        },
      ]),
      {
        ...emptyCatalog(),
        businessUnits: [
          {
            id: 'bu1',
            code: 'BU1',
            name: 'Comercial',
            description: null,
            status: 'ACTIVE',
            deletedAt: null,
          },
        ],
        areas: [
          {
            id: 'a1',
            code: 'OPS',
            name: 'Operaciones',
            description: null,
            status: 'ACTIVE',
            businessUnitId: 'bu1',
            parentAreaId: null,
            deletedAt: null,
          },
        ],
        positions: [
          {
            id: 'p1',
            code: 'ANL',
            name: 'Analista',
            areaId: 'a1',
            jobLevelId: null,
            headcount: 1,
            status: 'ACTIVE',
            deletedAt: null,
          },
        ],
        employees: [
          {
            id: 'e1',
            email: 'ada@example.com',
            firstName: 'Ada',
            lastName: 'Lovelace',
            status: EmployeeStatus.ACTIVE,
            businessUnitId: null,
            areaId: 'a1',
            positionId: 'p1',
            deletedAt: null,
          },
        ],
      },
    );
    expect(plan.canApply).toBe(true);
    expect(plan.summary.businessUnits.update).toBe(1);
    expect(plan.summary.employees.update).toBe(1);
  });

  it('rejects duplicate codes in the file', () => {
    const plan = buildOrgImportPlan(
      csv([
        { recordType: 'area', code: 'OPS', name: 'Uno' },
        { recordType: 'area', code: 'OPS', name: 'Dos' },
      ]),
      emptyCatalog(),
    );
    expect(plan.canApply).toBe(false);
    expect(plan.issues.some((item) => item.message.includes('duplicado'))).toBe(
      true,
    );
  });

  it('rejects a missing position reference', () => {
    const plan = buildOrgImportPlan(
      csv([
        {
          recordType: 'employee',
          email: 'ada@example.com',
          firstName: 'Ada',
          lastName: 'Lovelace',
          areaCode: 'OPS',
          positionCode: 'ABC',
        },
      ]),
      emptyCatalog(),
    );
    expect(plan.canApply).toBe(false);
    expect(
      plan.issues.some((item) =>
        item.message.includes('No existe el cargo ABC'),
      ),
    ).toBe(true);
  });

  it('rejects a missing manager', () => {
    const plan = buildOrgImportPlan(
      csv([
        { recordType: 'area', code: 'OPS', name: 'Ops' },
        {
          recordType: 'position',
          code: 'ANL',
          name: 'Analista',
          areaCode: 'OPS',
        },
        {
          recordType: 'employee',
          email: 'ada@example.com',
          firstName: 'Ada',
          lastName: 'Lovelace',
          areaCode: 'OPS',
          positionCode: 'ANL',
          managerEmail: 'ghost@example.com',
        },
      ]),
      emptyCatalog(),
    );
    expect(plan.canApply).toBe(false);
    expect(plan.issues.some((item) => item.field === 'managerEmail')).toBe(
      true,
    );
  });

  it('rejects self-manager', () => {
    const plan = buildOrgImportPlan(
      csv([
        { recordType: 'area', code: 'OPS', name: 'Ops' },
        {
          recordType: 'position',
          code: 'ANL',
          name: 'Analista',
          areaCode: 'OPS',
        },
        {
          recordType: 'employee',
          email: 'ada@example.com',
          firstName: 'Ada',
          lastName: 'Lovelace',
          areaCode: 'OPS',
          positionCode: 'ANL',
          managerEmail: 'ada@example.com',
        },
      ]),
      emptyCatalog(),
    );
    expect(plan.canApply).toBe(false);
    expect(
      plan.issues.some((item) => item.message.includes('su propio manager')),
    ).toBe(true);
  });

  it('rejects a reporting cycle in the file', () => {
    const plan = buildOrgImportPlan(
      csv([
        { recordType: 'area', code: 'OPS', name: 'Ops' },
        {
          recordType: 'position',
          code: 'ANL',
          name: 'Analista',
          areaCode: 'OPS',
        },
        {
          recordType: 'employee',
          email: 'a@example.com',
          firstName: 'A',
          lastName: 'A',
          areaCode: 'OPS',
          positionCode: 'ANL',
          managerEmail: 'c@example.com',
        },
        {
          recordType: 'employee',
          email: 'b@example.com',
          firstName: 'B',
          lastName: 'B',
          areaCode: 'OPS',
          positionCode: 'ANL',
          managerEmail: 'a@example.com',
        },
        {
          recordType: 'employee',
          email: 'c@example.com',
          firstName: 'C',
          lastName: 'C',
          areaCode: 'OPS',
          positionCode: 'ANL',
          managerEmail: 'b@example.com',
        },
      ]),
      emptyCatalog(),
    );
    expect(plan.canApply).toBe(false);
    expect(plan.issues.some((item) => item.message.includes('ciclo'))).toBe(
      true,
    );
  });

  it('rejects an invalid email', () => {
    const plan = buildOrgImportPlan(
      csv([
        { recordType: 'area', code: 'OPS', name: 'Ops' },
        {
          recordType: 'position',
          code: 'ANL',
          name: 'Analista',
          areaCode: 'OPS',
        },
        {
          recordType: 'employee',
          email: 'not-an-email',
          firstName: 'Ada',
          lastName: 'Lovelace',
          areaCode: 'OPS',
          positionCode: 'ANL',
        },
      ]),
      emptyCatalog(),
    );
    expect(plan.canApply).toBe(false);
    expect(plan.issues.some((item) => item.field === 'email')).toBe(true);
  });

  it('rejects unknown headers and companyId', () => {
    const withCompany = buildOrgImportPlan(
      'recordType,code,name,companyId\narea,OPS,Ops,secret\n',
      emptyCatalog(),
    );
    expect(withCompany.canApply).toBe(false);
    expect(withCompany.issues.some((item) => item.field === 'companyId')).toBe(
      true,
    );

    const unknown = buildOrgImportPlan(
      `${ORG_IMPORT_HEADERS.join(',')},salary\n`,
      emptyCatalog(),
    );
    expect(unknown.issues.some((item) => item.field === 'salary')).toBe(true);
  });

  it('rejects an oversized payload', () => {
    const plan = buildOrgImportPlan(
      'a'.repeat(6 * 1024 * 1024 + 10),
      emptyCatalog(),
    );
    expect(plan.canApply).toBe(false);
    expect(plan.issues[0]?.field).toBe('archivo');
  });

  it('rejects too many rows', () => {
    const extra = Array.from(
      { length: ORG_IMPORT_MAX_ROWS + 1 },
      (_, i) => `employee,E${i},N,d,ACTIVE,,, ,OPS,,,ANL,e${i}@x.com,A,B,`,
    );
    const plan = buildOrgImportPlan(
      `${ORG_IMPORT_HEADERS.join(',')}\n${extra.join('\n')}\n`,
      emptyCatalog(),
    );
    expect(plan.canApply).toBe(false);
    expect(plan.issues[0]?.field).toBe('archivo');
  });
});
