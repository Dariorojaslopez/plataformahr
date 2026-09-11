import type { OrgChartNode } from "@/types/organization";

export const ORG_CHART_UNASSIGNED = "__unassigned__";
export const ORG_CHART_VACANT_PREFIX = "vacant:";

export function isOrgChartVacant(node: OrgChartNode): boolean {
  return node.kind === "vacant" || node.employeeId.startsWith(ORG_CHART_VACANT_PREFIX);
}

export function vacantPositionRequestHref(positionId: string): string {
  return `/ats/vacancy-requests?positionId=${encodeURIComponent(positionId)}`;
}

export type OrgChartViewFilters = {
  businessUnitId?: string;
  jobLevelId?: string;
};

function displayName(node: OrgChartNode): string {
  if (isOrgChartVacant(node)) {
    return `\uffff ${node.position.name}`.toLowerCase();
  }
  return `${node.lastName} ${node.firstName}`.toLowerCase();
}

function vacantSlotId(positionId: string, index: number): string {
  return `${ORG_CHART_VACANT_PREFIX}${positionId}:${index}`;
}

function makeVacantNode(
  sample: OrgChartNode,
  index: number,
  managerId: string | null,
): OrgChartNode {
  return {
    employeeId: vacantSlotId(sample.position.id, index),
    firstName: "",
    lastName: "",
    status: "ACTIVE",
    kind: "vacant",
    managerId,
    position: sample.position,
    jobLevel: sample.jobLevel,
    area: sample.area,
    businessUnit: sample.businessUnit,
    children: [],
  };
}

/**
 * Adds empty boxes for unfilled plazas (headcount − people in that cargo).
 * Vacant slots hang next to the people already in the same cargo.
 */
export function expandOrgChartSlots(roots: OrgChartNode[]): OrgChartNode[] {
  const occupantsByPosition = new Map<string, number>();
  const sampleByPosition = new Map<string, OrgChartNode>();

  for (const node of flattenOrgChart(roots)) {
    if (isOrgChartVacant(node)) continue;
    occupantsByPosition.set(
      node.position.id,
      (occupantsByPosition.get(node.position.id) ?? 0) + 1,
    );
    sampleByPosition.set(node.position.id, node);
  }

  const remaining = new Map<string, number>();
  for (const [positionId, sample] of sampleByPosition) {
    const headcount = sample.position.headcount ?? occupantsByPosition.get(positionId) ?? 0;
    const occupied = occupantsByPosition.get(positionId) ?? 0;
    remaining.set(positionId, Math.max(0, headcount - occupied));
  }

  function expand(
    nodes: OrgChartNode[],
    managerId: string | null,
  ): OrgChartNode[] {
    const next = nodes.map((node) => ({
      ...node,
      children: expand(node.children, node.employeeId),
    }));
    const added: OrgChartNode[] = [];
    const seen = new Set<string>();
    for (const node of next) {
      if (isOrgChartVacant(node) || seen.has(node.position.id)) continue;
      seen.add(node.position.id);
      const left = remaining.get(node.position.id) ?? 0;
      if (left <= 0) continue;
      remaining.set(node.position.id, 0);
      for (let index = 0; index < left; index += 1) {
        added.push(makeVacantNode(node, index, managerId));
      }
    }
    return [...next, ...added];
  }

  return expand(roots, null);
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
