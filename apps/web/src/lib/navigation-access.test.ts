import { describe, expect, it } from "vitest";
import {
  APP_NAV,
  filterNavigation,
  flattenNavItems,
  resolveCompanyAccessForPath,
} from "./navigation";

describe("company navigation access", () => {
  it("shows only enabled modules and menu features", () => {
    const filtered = flattenNavItems(
      filterNavigation(APP_NAV, {
        enabledModules: ["ATS"],
        enabledFeatures: ["ats.vacancies", "ats.pipeline"],
      }),
    );
    expect(filtered.map(({ href }) => href)).toEqual([
      "/dashboard",
      "/ats/vacancies",
      "/ats/pipeline",
    ]);
  });

  it("maps nested detail routes to their protected feature", () => {
    expect(resolveCompanyAccessForPath("/ats/applications/abc")).toEqual({
      module: "ATS",
      feature: "ats.pipeline",
    });
    expect(resolveCompanyAccessForPath("/organization/employees/abc")).toEqual({
      module: "ORGANIZATION",
      feature: "organization.employees",
    });
    expect(
      resolveCompanyAccessForPath("/performance/my-evaluations/abc"),
    ).toEqual({
      module: "PERFORMANCE",
      feature: "performance.my-evaluations",
    });
  });
});
