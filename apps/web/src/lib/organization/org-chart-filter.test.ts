import { describe, expect, it } from "vitest";
import {
  ORG_CHART_UNASSIGNED,
  countOrgChartNodes,
  filterOrgChartForest,
} from "@/lib/organization/org-chart-filter";
import type { OrgChartNode } from "@/types/organization";

function node(
  partial: Pick<OrgChartNode, "employeeId" | "firstName" | "lastName"> &
    Partial<OrgChartNode>,
): OrgChartNode {
  return {
    status: "ACTIVE",
    managerId: null,
    position: { id: `p-${partial.employeeId}`, name: "Analista" },
    jobLevel: { id: "jl-1", name: "N-1", rank: 1 },
    area: { id: "a", name: "Operaciones" },
    businessUnit: { id: "bu-com", name: "Comercial" },
    children: [],
    ...partial,
  };
}

const leaf = node({
  employeeId: "leaf",
  firstName: "Luis",
  lastName: "Reporte",
  managerId: "mgr",
  jobLevel: { id: "jl-2", name: "N-2", rank: 2 },
  businessUnit: { id: "bu-ops", name: "Operaciones" },
});

const manager = node({
  employeeId: "mgr",
  firstName: "Ana",
  lastName: "Jefe",
  children: [leaf],
});

describe("filterOrgChartForest", () => {
  it("returns the same forest when no filters are set", () => {
    const roots = [manager];
    expect(filterOrgChartForest(roots, {})).toBe(roots);
  });

  it("keeps a business unit and promotes leftover reports to roots", () => {
    const filtered = filterOrgChartForest([manager], {
      businessUnitId: "bu-ops",
    });
    expect(filtered.map((item) => item.employeeId)).toEqual(["leaf"]);
    expect(filtered[0]?.managerId).toBe("mgr");
    expect(filtered[0]?.children).toEqual([]);
  });

  it("filters by job level", () => {
    const filtered = filterOrgChartForest([manager], { jobLevelId: "jl-1" });
    expect(filtered.map((item) => item.employeeId)).toEqual(["mgr"]);
    expect(filtered[0]?.children).toEqual([]);
  });

  it("applies business unit and job level together", () => {
    const both = node({
      employeeId: "both",
      firstName: "Marta",
      lastName: "Match",
      managerId: "mgr",
      jobLevel: { id: "jl-1", name: "N-1", rank: 1 },
      businessUnit: { id: "bu-com", name: "Comercial" },
    });
    const roots = [
      node({
        ...manager,
        children: [leaf, both],
      }),
    ];
    const filtered = filterOrgChartForest(roots, {
      businessUnitId: "bu-com",
      jobLevelId: "jl-1",
    });
    expect(filtered.map((item) => item.employeeId)).toEqual(["mgr"]);
    expect(filtered[0]?.children.map((item) => item.employeeId)).toEqual([
      "both",
    ]);
    expect(countOrgChartNodes(filtered)).toBe(2);
  });

  it("can isolate people without a business unit", () => {
    const solo = node({
      employeeId: "solo",
      firstName: "Marta",
      lastName: "Independiente",
      businessUnit: null,
    });
    const filtered = filterOrgChartForest([manager, solo], {
      businessUnitId: ORG_CHART_UNASSIGNED,
    });
    expect(filtered.map((item) => item.employeeId)).toEqual(["solo"]);
  });
});
