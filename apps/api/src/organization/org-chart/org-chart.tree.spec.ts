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
      positionId?: string;
      parentPositionId?: string | null;
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
      id: partial.positionId ?? `pos-${partial.id}`,
      name: partial.positionName ?? 'Cargo',
      parentPositionId: partial.parentPositionId ?? null,
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

  it('nests under the unique occupant of the parent cargo when there is no DIRECT manager', () => {
    const forest = buildOrgChartForest([
      row({
        id: 'boss',
        firstName: 'Ana',
        lastName: 'Jefe',
        positionId: 'gerente',
        positionName: 'Gerente',
      }),
      row({
        id: 'emp',
        firstName: 'Luis',
        lastName: 'Recluta',
        positionId: 'reclutador',
        positionName: 'Reclutador',
        parentPositionId: 'gerente',
      }),
    ]);
    expect(forest).toHaveLength(1);
    expect(forest[0].employeeId).toBe('boss');
    expect(forest[0].children[0].employeeId).toBe('emp');
    expect(forest[0].children[0].managerId).toBe('boss');
  });

  it('keeps an explicit DIRECT manager over the parent cargo', () => {
    const forest = buildOrgChartForest([
      row({
        id: 'boss',
        firstName: 'Ana',
        lastName: 'Jefe',
        positionId: 'gerente',
      }),
      row({
        id: 'other',
        firstName: 'Sol',
        lastName: 'Otra',
      }),
      row({
        id: 'emp',
        firstName: 'Luis',
        lastName: 'Recluta',
        parentPositionId: 'gerente',
        managerId: 'other',
      }),
    ]);
    const other = forest.find((node) => node.employeeId === 'other');
    expect(other?.children.map((child) => child.employeeId)).toEqual(['emp']);
  });

  it('does not infer a manager when the parent cargo has several occupants', () => {
    const forest = buildOrgChartForest([
      row({
        id: 'b1',
        firstName: 'Ana',
        lastName: 'Uno',
        positionId: 'gerente',
      }),
      row({
        id: 'b2',
        firstName: 'Bea',
        lastName: 'Dos',
        positionId: 'gerente',
      }),
      row({
        id: 'emp',
        firstName: 'Luis',
        lastName: 'Recluta',
        parentPositionId: 'gerente',
      }),
    ]);
    expect(forest.some((node) => node.employeeId === 'emp')).toBe(true);
  });
});
