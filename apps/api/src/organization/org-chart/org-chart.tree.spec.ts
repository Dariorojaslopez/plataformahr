import { EmployeeStatus } from '@prisma/client';
import {
  buildOrgChartForest,
  countOrgChartNodes,
  type OrgChartEmployeeRow,
} from './org-chart.tree';

function row(
  partial: Pick<OrgChartEmployeeRow, 'id' | 'firstName' | 'lastName'> &
    Partial<OrgChartEmployeeRow> & {
      managerId?: string | null;
      areaName?: string;
      positionName?: string;
      businessUnitName?: string | null;
      jobLevelName?: string | null;
    },
): OrgChartEmployeeRow {
  return {
    id: partial.id,
    firstName: partial.firstName,
    lastName: partial.lastName,
    status: partial.status ?? EmployeeStatus.ACTIVE,
    businessUnit: partial.businessUnitName
      ? { id: `bu-${partial.id}`, name: partial.businessUnitName }
      : null,
    area: { id: `area-${partial.id}`, name: partial.areaName ?? 'Área' },
    position: {
      id: `pos-${partial.id}`,
      name: partial.positionName ?? 'Cargo',
      jobLevel: partial.jobLevelName
        ? { id: `jl-${partial.id}`, name: partial.jobLevelName, rank: 1 }
        : null,
    },
    reportingTo: partial.managerId
      ? [{ managerEmployeeId: partial.managerId }]
      : [],
  };
}

describe('buildOrgChartForest', () => {
  it('returns an empty forest when the company has no employees', () => {
    expect(buildOrgChartForest([])).toEqual([]);
  });

  it('treats a single employee without manager as the only root', () => {
    const forest = buildOrgChartForest([
      row({ id: 'e1', firstName: 'Ada', lastName: 'Lovelace' }),
    ]);
    expect(forest).toHaveLength(1);
    expect(forest[0].employeeId).toBe('e1');
    expect(forest[0].managerId).toBeNull();
    expect(forest[0].children).toEqual([]);
  });

  it('keeps multiple employees without manager as multiple roots', () => {
    const forest = buildOrgChartForest([
      row({ id: 'e2', firstName: 'Grace', lastName: 'Hopper' }),
      row({ id: 'e1', firstName: 'Ada', lastName: 'Lovelace' }),
    ]);
    expect(forest.map((node) => node.employeeId)).toEqual(['e2', 'e1']);
  });

  it('nests a collaborator under the DIRECT manager', () => {
    const forest = buildOrgChartForest([
      row({ id: 'mgr', firstName: 'Ana', lastName: 'Jefe' }),
      row({
        id: 'emp',
        firstName: 'Luis',
        lastName: 'Reporte',
        managerId: 'mgr',
      }),
    ]);
    expect(forest).toHaveLength(1);
    expect(forest[0].employeeId).toBe('mgr');
    expect(forest[0].children).toHaveLength(1);
    expect(forest[0].children[0].employeeId).toBe('emp');
    expect(forest[0].children[0].managerId).toBe('mgr');
  });

  it('builds three hierarchical levels', () => {
    const forest = buildOrgChartForest([
      row({ id: 'a', firstName: 'A', lastName: 'Root' }),
      row({ id: 'b', firstName: 'B', lastName: 'Mid', managerId: 'a' }),
      row({ id: 'c', firstName: 'C', lastName: 'Leaf', managerId: 'b' }),
    ]);
    expect(forest[0].employeeId).toBe('a');
    expect(forest[0].children[0].employeeId).toBe('b');
    expect(forest[0].children[0].children[0].employeeId).toBe('c');
    expect(countOrgChartNodes(forest)).toBe(3);
  });

  it('allows a company without business units and a position without job level', () => {
    const forest = buildOrgChartForest([
      row({
        id: 'e1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        businessUnitName: null,
        jobLevelName: null,
      }),
    ]);
    expect(forest[0].businessUnit).toBeNull();
    expect(forest[0].jobLevel).toBeNull();
  });

  it('does not put an employee under a manager outside the visible set', () => {
    const forest = buildOrgChartForest([
      row({
        id: 'e1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        managerId: 'missing',
      }),
    ]);
    expect(forest).toHaveLength(1);
    expect(forest[0].managerId).toBe('missing');
    expect(forest[0].children).toEqual([]);
  });

  it('breaks stored cycles so the tree cannot recurse forever', () => {
    const forest = buildOrgChartForest([
      row({ id: 'a', firstName: 'A', lastName: 'A', managerId: 'c' }),
      row({ id: 'b', firstName: 'B', lastName: 'B', managerId: 'a' }),
      row({ id: 'c', firstName: 'C', lastName: 'C', managerId: 'b' }),
    ]);
    expect(countOrgChartNodes(forest)).toBe(3);
    expect(forest.length).toBeGreaterThanOrEqual(1);
  });

  it('omits email and other PII from nodes', () => {
    const json = JSON.stringify(
      buildOrgChartForest([
        row({ id: 'e1', firstName: 'Ada', lastName: 'Lovelace' }),
      ]),
    );
    expect(json).not.toMatch(/email|phone|birthDate|salary|address/i);
  });
});
