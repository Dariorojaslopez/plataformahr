import type { OrgChartNode } from "@/types/organization";

export const ORG_CHART_UNASSIGNED = "__unassigned__";

export type OrgChartViewFilters = {
  businessUnitId?: string;
  jobLevelId?: string;
};

function displayName(node: OrgChartNode): string {
  return `${node.lastName} ${node.firstName}`.toLowerCase();
}

function nodeMatches(
  node: OrgChartNode,
  filters: OrgChartViewFilters,
): boolean {
  if (filters.businessUnitId) {
    if (filters.businessUnitId === ORG_CHART_UNASSIGNED) {
      if (node.businessUnit) return false;
    } else if (node.businessUnit?.id !== filters.businessUnitId) {
      return false;
    }
  }
  if (filters.jobLevelId) {
    if (filters.jobLevelId === ORG_CHART_UNASSIGNED) {
      if (node.jobLevel) return false;
    } else if (node.jobLevel?.id !== filters.jobLevelId) {
      return false;
    }
  }
  return true;
}

export function flattenOrgChart(nodes: OrgChartNode[]): OrgChartNode[] {
  const out: OrgChartNode[] = [];
  for (const node of nodes) {
    out.push(node);
    out.push(...flattenOrgChart(node.children));
  }
  return out;
}

export function countOrgChartNodes(nodes: OrgChartNode[]): number {
  return nodes.reduce(
    (total, node) => total + 1 + countOrgChartNodes(node.children),
    0,
  );
}

export function rebuildOrgChartForest(nodes: OrgChartNode[]): OrgChartNode[] {
  const byId = new Map(nodes.map((node) => [node.employeeId, node]));
  const childrenByManager = new Map<string, OrgChartNode[]>();

  for (const node of nodes) {
    if (!node.managerId || !byId.has(node.managerId)) continue;
    const current = childrenByManager.get(node.managerId) ?? [];
    current.push(node);
    childrenByManager.set(node.managerId, current);
  }

  const visited = new Set<string>();

  function clone(node: OrgChartNode, path: Set<string>): OrgChartNode {
    visited.add(node.employeeId);
    const nextPath = new Set(path);
    nextPath.add(node.employeeId);
    const children = (childrenByManager.get(node.employeeId) ?? [])
      .filter((child) => !path.has(child.employeeId))
      .sort((a, b) => displayName(a).localeCompare(displayName(b)))
      .map((child) => clone(child, nextPath));
    return { ...node, children };
  }

  const roots: OrgChartNode[] = [];
  const naturalRoots = nodes
    .filter((node) => !node.managerId || !byId.has(node.managerId))
    .sort((a, b) => displayName(a).localeCompare(displayName(b)));

  for (const node of naturalRoots) {
    roots.push(clone(node, new Set()));
  }

  const leftovers = nodes
    .filter((node) => !visited.has(node.employeeId))
    .sort((a, b) => displayName(a).localeCompare(displayName(b)));
  for (const node of leftovers) {
    if (visited.has(node.employeeId)) continue;
    roots.push(clone(node, new Set()));
  }

  return roots;
}

/** Drops nodes that miss the filters and re-roots anyone whose manager left. */
export function filterOrgChartForest(
  roots: OrgChartNode[],
  filters: OrgChartViewFilters,
): OrgChartNode[] {
  if (!filters.businessUnitId && !filters.jobLevelId) return roots;
  const kept = flattenOrgChart(roots).filter((node) =>
    nodeMatches(node, filters),
  );
  return rebuildOrgChartForest(kept);
}
