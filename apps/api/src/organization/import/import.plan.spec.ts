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
          name: 'Junior',
          rank: '1',
        },
        {
          recordType: 'area',
          name: 'Operaciones',
        },
        {
          recordType: 'position',
          name: 'Analista',
          areaName: 'Operaciones',
          jobLevelName: 'Junior',
        },
        {
          recordType: 'employee',
          email: 'ada@example.com',
          firstName: 'Ada',
          lastName: 'Lovelace',
          areaName: 'Operaciones',
          positionName: 'Analista',
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
        { recordType: 'businessUnit', name: 'Comercial' },
        { recordType: 'jobLevel', name: 'Junior', rank: '1' },
        {
          recordType: 'area',
          name: 'Operaciones',
          businessUnitName: 'Comercial',
        },
        {
          recordType: 'position',
          name: 'Analista',
          areaName: 'Operaciones',
          jobLevelName: 'Junior',
        },
        {
          recordType: 'employee',
          email: 'luis@example.com',
          firstName: 'Luis',
          lastName: 'Reporte',
          areaName: 'Operaciones',
          positionName: 'Analista',
          managerEmail: 'ana@example.com',
        },
        {
          recordType: 'employee',
          email: 'ana@example.com',
          firstName: 'Ana',
          lastName: 'Jefe',
          areaName: 'Operaciones',
          positionName: 'Analista',
        },
      ]),
      emptyCatalog(),
    );
    expect(plan.canApply).toBe(true);
    expect(plan.reportingLines[0]?.managerEmail).toBe('ana@example.com');
    expect(plan.summary.reportingLines.create).toBe(1);
  });

  it('updates existing records matched by name or email', () => {
    const plan = buildOrgImportPlan(
      csv([
        { recordType: 'businessUnit', name: 'Comercial', description: 'Norte' },
        {
          recordType: 'employee',
          email: 'ada@example.com',
          firstName: 'Ada',
          lastName: 'Updated',
          areaName: 'Operaciones',
          positionName: 'Analista',
        },
      ]),
      {
        ...emptyCatalog(),
        businessUnits: [
          {
            id: 'bu1',
            code: '001',
            name: 'Comercial',
            description: null,
            status: 'ACTIVE',
            deletedAt: null,
          },
        ],
        areas: [
          {
            id: 'a1',
            code: '001',
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
            code: '001',
            name: 'Analista',
            areaId: 'a1',
            jobLevelId: null,
            parentPositionId: null,
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

  it('rejects duplicate names in the file', () => {
    const plan = buildOrgImportPlan(
      csv([
        { recordType: 'area', name: 'Operaciones' },
        { recordType: 'area', name: 'Operaciones' },
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
          areaName: 'Operaciones',
          positionName: 'ABC',
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
        { recordType: 'area', name: 'Ops' },
        {
          recordType: 'position',
          name: 'Analista',
          areaName: 'Ops',
        },
        {
          recordType: 'employee',
          email: 'ada@example.com',
          firstName: 'Ada',
          lastName: 'Lovelace',
          areaName: 'Ops',
          positionName: 'Analista',
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
        { recordType: 'area', name: 'Ops' },
        {
          recordType: 'position',
          name: 'Analista',
          areaName: 'Ops',
        },
        {
          recordType: 'employee',
          email: 'ada@example.com',
          firstName: 'Ada',
          lastName: 'Lovelace',
          areaName: 'Ops',
          positionName: 'Analista',
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
        { recordType: 'area', name: 'Ops' },
        {
          recordType: 'position',
          name: 'Analista',
          areaName: 'Ops',
        },
        {
          recordType: 'employee',
          email: 'a@example.com',
          firstName: 'A',
          lastName: 'A',
          areaName: 'Ops',
          positionName: 'Analista',
          managerEmail: 'c@example.com',
        },
        {
          recordType: 'employee',
          email: 'b@example.com',
          firstName: 'B',
          lastName: 'B',
          areaName: 'Ops',
          positionName: 'Analista',
          managerEmail: 'a@example.com',
        },
        {
          recordType: 'employee',
          email: 'c@example.com',
          firstName: 'C',
          lastName: 'C',
          areaName: 'Ops',
          positionName: 'Analista',
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
        { recordType: 'area', name: 'Ops' },
        {
          recordType: 'position',
          name: 'Analista',
          areaName: 'Ops',
        },
        {
          recordType: 'employee',
          email: 'not-an-email',
          firstName: 'Ada',
          lastName: 'Lovelace',
          areaName: 'Ops',
          positionName: 'Analista',
        },
      ]),
      emptyCatalog(),
    );
    expect(plan.canApply).toBe(false);
    expect(plan.issues.some((item) => item.field === 'email')).toBe(true);
  });

  it('rejects unknown headers and companyId, and ignores leftover code columns', () => {
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

    const leftoverCode = buildOrgImportPlan(
      [
        ['code', ...ORG_IMPORT_HEADERS].join(','),
        ['IGNORAR', 'area', 'Talento', ...Array(ORG_IMPORT_HEADERS.length - 2).fill('')].join(','),
        '',
      ].join('\n'),
      emptyCatalog(),
    );
    expect(leftoverCode.canApply).toBe(true);
    expect(leftoverCode.summary.areas.create).toBe(1);
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
      (_, i) => `employee,n${i}`,
    );
    const plan = buildOrgImportPlan(
      `${ORG_IMPORT_HEADERS.join(',')}\n${extra.join('\n')}\n`,
      emptyCatalog(),
    );
    expect(plan.canApply).toBe(false);
    expect(plan.issues[0]?.field).toBe('archivo');
  });

  it('links a cargo to the cargo it reports to', () => {
    const plan = buildOrgImportPlan(
      csv([
        { recordType: 'area', name: 'Ops' },
        { recordType: 'position', name: 'Gerente', areaName: 'Ops' },
        {
          recordType: 'position',
          name: 'Reclutador',
          areaName: 'Ops',
          parentPositionName: 'Gerente',
        },
      ]),
      emptyCatalog(),
    );
    expect(plan.canApply).toBe(true);
    expect(plan.positions.find((item) => item.name === 'Reclutador')?.parentPositionName).toBe(
      'Gerente',
    );
  });

  it('rejects a cargo reporting cycle', () => {
    const plan = buildOrgImportPlan(
      csv([
        { recordType: 'area', name: 'Ops' },
        {
          recordType: 'position',
          name: 'A',
          areaName: 'Ops',
          parentPositionName: 'B',
        },
        {
          recordType: 'position',
          name: 'B',
          areaName: 'Ops',
          parentPositionName: 'A',
        },
      ]),
      emptyCatalog(),
    );
    expect(plan.canApply).toBe(false);
    expect(
      plan.issues.some((item) => item.message.includes('jerarquía de cargos')),
    ).toBe(true);
  });
});
