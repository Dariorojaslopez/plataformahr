import { describe, expect, it } from "vitest";
import {
  COMPANY_FEATURE_CODES,
  COMPANY_MODULE_CODES,
} from "@talento/shared";
import {
  HOME_SHORTCUTS,
  groupedHomeShortcuts,
  homeDescription,
  homeShortcutsFor,
  resolveHomeRoleFromAccess,
} from "./home-view";

const fullAccess = {
  enabledModules: [...COMPANY_MODULE_CODES],
  enabledFeatures: [...COMPANY_FEATURE_CODES],
};

describe("home view by role", () => {
  it("uses the API homeRole when present", () => {
    expect(
      resolveHomeRoleFromAccess({
        ...fullAccess,
        roleCodes: ["COLLABORATOR"],
        hasDirectReports: true,
        homeRole: "LEADER",
      }),
    ).toBe("LEADER");
  });

  it("falls back to collaborator when access has no role payload", () => {
    expect(resolveHomeRoleFromAccess(fullAccess)).toBe("COLLABORATOR");
  });

  it("does not share the same shortcuts across the four HOME roles", () => {
    const hrefs = (role: keyof typeof HOME_SHORTCUTS) =>
      homeShortcutsFor(role, fullAccess).map(({ href }) => href);

    expect(hrefs("COLLABORATOR")).toEqual([
      "/performance/my-evaluations",
      "/performance/my-results",
      "/goals",
      "/ats/vacancy-requests",
    ]);
    expect(hrefs("LEADER")).toContain("/organization/org-chart");
    expect(hrefs("LEADER")).not.toContain("/goals/team");
    expect(hrefs("LEADER")).not.toContain("/organization/employees");
    expect(hrefs("RECRUITER")).toEqual([
      "/ats/vacancies",
      "/ats/candidates",
      "/ats/pipeline",
      "/ats/interviews",
      "/ats/vacancy-requests",
    ]);
    expect(hrefs("CLIENT_ADMIN")).toContain("/organization/employees");
    expect(hrefs("CLIENT_ADMIN")).toContain("/ats/settings/approvals");
    expect(hrefs("CLIENT_ADMIN")).toContain("/ats/settings/evaluators");
    expect(hrefs("CLIENT_ADMIN")).toContain("/ats/settings/active-processes");
    expect(hrefs("CLIENT_ADMIN")).toContain("/performance/cycles");
    expect(hrefs("CLIENT_ADMIN")).toContain("/performance/population");
    expect(hrefs("CLIENT_ADMIN")).toContain("/performance/calibration");
    expect(hrefs("CLIENT_ADMIN")).toContain("/performance/9box");
    expect(hrefs("CLIENT_ADMIN")).toContain("/organization/settings");
    expect(hrefs("CLIENT_ADMIN")).not.toContain("/ats/pipeline");
    expect(hrefs("CLIENT_ADMIN")).toContain("/settings/branding");
    expect(hrefs("CLIENT_ADMIN")).not.toContain("/ats/pipeline");
    expect(hrefs("COLLABORATOR")).not.toEqual(hrefs("LEADER"));
    expect(hrefs("LEADER")).not.toEqual(hrefs("RECRUITER"));
    expect(hrefs("RECRUITER")).not.toEqual(hrefs("CLIENT_ADMIN"));
  });

  it("hides shortcuts whose company feature is off", () => {
    const shortcuts = homeShortcutsFor("RECRUITER", {
      enabledModules: ["ATS"],
      enabledFeatures: ["ats.vacancies", "ats.pipeline"],
    });
    expect(shortcuts.map(({ href }) => href)).toEqual([
      "/ats/vacancies",
      "/ats/pipeline",
    ]);
  });

  it("groups administrator shortcuts by configuration area", () => {
    const sections = groupedHomeShortcuts(
      homeShortcutsFor("CLIENT_ADMIN", fullAccess),
    );
    expect(sections.map((section) => section.group)).toEqual([
      "organization",
      "ats",
      "performance",
      "system",
    ]);
    expect(sections[0]?.items.map((item) => item.href)).toContain(
      "/organization/employees",
    );
    expect(sections[3]?.items.map((item) => item.href)).toEqual([
      "/settings/branding",
    ]);
  });

  it("writes role-specific copy", () => {
    expect(homeDescription("COLLABORATOR", "Acme")).toMatch(/perfil/);
    expect(homeDescription("LEADER", "Acme")).toMatch(/solicitudes de selección/);
    expect(homeDescription("RECRUITER", "Acme")).toMatch(/procesos que te asignaron/);
    expect(homeDescription("CLIENT_ADMIN", "Acme")).toMatch(/configuración/);
  });
});
