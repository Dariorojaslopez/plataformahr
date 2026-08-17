import { EmployeeStatus } from '@prisma/client';

export type OrgChartEmployeeRow = {
  id: string;
  firstName: string;
  lastName: string;
  status: EmployeeStatus;
  businessUnit: { id: string; name: string } | null;
  area: { id: string; name: string };
  position: {
    id: string;
    name: string;
    jobLevel: { id: string; name: string; rank: number } | null;
  };
  reportingTo: Array<{ managerEmployeeId: string }>;
};

export type OrgChartNode = {
  employeeId: string;
  firstName: string;
  lastName: string;
  status: EmployeeStatus;
  managerId: string | null;
  position: { id: string; name: string };
  jobLevel: { id: string; name: string; rank: number } | null;
  area: { id: string; name: string };
  businessUnit: { id: string; name: string } | null;
  children: OrgChartNode[];
};

function displayName(row: OrgChartEmployeeRow): string {
  return `${row.lastName} ${row.firstName}`.toLowerCase();
}

function directManagerId(row: OrgChartEmployeeRow): string | null {
  return row.reportingTo[0]?.managerEmployeeId ?? null;
}

function toNode(
  row: OrgChartEmployeeRow,
  childrenByManager: Map<string, OrgChartEmployeeRow[]>,
  path: Set<string>,
  visited: Set<string>,
): OrgChartNode {
  visited.add(row.id);
  const nextPath = new Set(path);
  nextPath.add(row.id);
  const childRows = childrenByManager.get(row.id) ?? [];
  const children = childRows
    .filter((child) => !path.has(child.id))
    .sort((a, b) => displayName(a).localeCompare(displayName(b)))
    .map((child) => toNode(child, childrenByManager, nextPath, visited));

  return {
    employeeId: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    status: row.status,
    managerId: directManagerId(row),
    position: { id: row.position.id, name: row.position.name },
    jobLevel: row.position.jobLevel
      ? {
          id: row.position.jobLevel.id,
          name: row.position.jobLevel.name,
          rank: row.position.jobLevel.rank,
        }
      : null,
    area: { id: row.area.id, name: row.area.name },
    businessUnit: row.businessUnit
      ? { id: row.businessUnit.id, name: row.businessUnit.name }
      : null,
    children,
  };
}

/**
 * Builds a forest from DIRECT reporting lines. An employee whose manager is
 * missing from the visible set becomes a root (managerId still records the
 * real manager). Cycles in stored data are broken so rendering cannot loop:
 * leftover nodes in a closed cycle are promoted to extra roots.
 */
export function buildOrgChartForest(
  rows: OrgChartEmployeeRow[],
): OrgChartNode[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const childrenByManager = new Map<string, OrgChartEmployeeRow[]>();

  for (const row of rows) {
    const managerId = directManagerId(row);
    if (!managerId || !byId.has(managerId)) {
      continue;
    }
    const current = childrenByManager.get(managerId) ?? [];
    current.push(row);
    childrenByManager.set(managerId, current);
  }

  const visited = new Set<string>();
  const roots: OrgChartNode[] = [];
  const naturalRoots = rows
    .filter((row) => {
      const managerId = directManagerId(row);
      return !managerId || !byId.has(managerId);
    })
    .sort((a, b) => displayName(a).localeCompare(displayName(b)));

  for (const row of naturalRoots) {
    roots.push(toNode(row, childrenByManager, new Set(), visited));
  }

  const leftovers = rows
    .filter((row) => !visited.has(row.id))
    .sort((a, b) => displayName(a).localeCompare(displayName(b)));
  for (const row of leftovers) {
    if (visited.has(row.id)) continue;
    roots.push(toNode(row, childrenByManager, new Set(), visited));
  }

  return roots;
}

export function countOrgChartNodes(nodes: OrgChartNode[]): number {
  return nodes.reduce(
    (total, node) => total + 1 + countOrgChartNodes(node.children),
    0,
  );
}
