import { describe, expect, it } from "vitest";
import {
  APP_NAV,
  flattenNavItems,
  isNavItemActive,
  navHrefMatchesPath,
  resolveActiveNavHref,
} from "@/lib/navigation";

function activeLabels(pathname: string): string[] {
  return flattenNavItems()
    .filter((item) => isNavItemActive(pathname, item.href))
    .map((item) => item.label);
}

function prefixPairs() {
  const items = flattenNavItems().filter((item) => !item.disabled);
  const pairs: Array<{ parent: string; child: string }> = [];
  for (const parent of items) {
    for (const child of items) {
      if (parent.href === child.href) continue;
      if (navHrefMatchesPath(parent.href, child.href)) {
        pairs.push({ parent: parent.href, child: child.href });
      }
    }
  }
  return pairs;
}

describe("resolveActiveNavHref", () => {
  it("activates only Objetivos organizacionales on /goals", () => {
    expect(resolveActiveNavHref("/goals")).toBe("/goals");
    expect(activeLabels("/goals")).toEqual(["Objetivos organizacionales"]);
  });

  it("does not keep Periodos in the menu", () => {
    expect(flattenNavItems().some((item) => item.href === "/goals/cycles")).toBe(
      false,
    );
  });

  it("still treats a goal detail as Objetivos organizacionales", () => {
    expect(resolveActiveNavHref("/goals/goal-1")).toBe("/goals");
    expect(activeLabels("/goals/goal-1")).toEqual([
      "Objetivos organizacionales",
    ]);
  });

  it("resolves every APP_NAV parent/child pair to the more specific item", () => {
    const pairs = prefixPairs();
    expect(pairs).not.toEqual(
      expect.arrayContaining([
        { parent: "/goals", child: "/goals/cycles" },
        { parent: "/goals", child: "/goals/team" },
        { parent: "/goals", child: "/goals/reviews" },
      ]),
    );
    for (const { parent, child } of pairs) {
      expect(resolveActiveNavHref(child)).toBe(child);
      expect(resolveActiveNavHref(`${child}/nested`)).toBe(child);
      expect(isNavItemActive(child, parent)).toBe(false);
      expect(isNavItemActive(`${child}/nested`, parent)).toBe(false);
    }
  });

  it("does not highlight lookalike ATS or Performance hrefs", () => {
    expect(activeLabels("/ats/interview-templates")).toEqual([
      "Plantillas de entrevista",
    ]);
    expect(activeLabels("/ats/vacancy-requests")).toEqual([
      "Crear proceso de selección",
    ]);
    expect(activeLabels("/ats/vacancies/vac-1")).toEqual(["Vacantes"]);
    expect(activeLabels("/performance/results")).toEqual(["Resultados"]);
    expect(activeLabels("/performance/my-results")).toEqual(["Mis resultados"]);
    expect(activeLabels("/performance/my-results/r-1")).toEqual([
      "Mis resultados",
    ]);
    expect(activeLabels("/organization/employees/emp-1")).toEqual([
      "Colaboradores",
    ]);
  });

  it("never marks two nav items active for APP_NAV routes or nested details", () => {
    const samples = [
      ...flattenNavItems().map((item) => item.href),
      "/dashboard",
      "/unknown",
      "/ats/vacancies/vac-1",
      "/ats/vacancy-requests/req-1",
      "/ats/interviews/int-1",
      "/ats/interview-templates",
      "/ats/settings/approvals",
      "/ats/settings/evaluators",
      "/ats/settings/active-processes",
      "/performance/cycles/c-1",
      "/performance/9box",
      "/performance/calibration",
      "/performance/results/r-1",
      "/performance/my-results/r-1",
      "/organization/employees/emp-1",
      "/dashboard",
      "/unknown",
    ];
    for (const pathname of samples) {
      expect(activeLabels(pathname).length).toBeLessThanOrEqual(1);
    }
  });

  it("matches exact hrefs for every enabled APP_NAV item", () => {
    for (const item of flattenNavItems()) {
      if (item.disabled) continue;
      expect(resolveActiveNavHref(item.href)).toBe(item.href);
      expect(activeLabels(item.href)).toEqual([item.label]);
    }
  });

  it("covers every APP_NAV section in uniqueness checks", () => {
    expect(APP_NAV.map((section) => section.title)).toEqual([
      undefined,
      "Organización",
      "ATS",
      "Performance",
      "Configuración",
    ]);
  });
});
