import { describe, expect, it } from "vitest";
import {
  buildOrganizationalGoalCreate,
  canManageOrganizationalGoals,
  emptyOrganizationalGoalForm,
} from "./organizational-form";

describe("organizational goals form", () => {
  it("lets company admins and performance managers create org goals", () => {
    expect(canManageOrganizationalGoals(["CLIENT_ADMIN"])).toBe(true);
    expect(canManageOrganizationalGoals(["PERFORMANCE_MANAGER"])).toBe(true);
    expect(canManageOrganizationalGoals(["COLLABORATOR"])).toBe(false);
    expect(canManageOrganizationalGoals([])).toBe(false);
  });

  it("builds a company goal with percentage target", () => {
    const form = {
      ...emptyOrganizationalGoalForm(),
      cycleId: "cycle-1",
      title: "  NPS compañía  ",
      description: " Meta anual ",
      metricType: "PERCENTAGE" as const,
      direction: "INCREASE" as const,
      startValue: "40",
      targetValue: "70",
    };
    const payload = buildOrganizationalGoalCreate(form);
    expect(payload.cycle).toEqual({ id: "cycle-1" });
    expect(payload.goal).toEqual({
      title: "NPS compañía",
      description: "Meta anual",
      type: "COMPANY",
    });
    expect(payload.keyResult).toMatchObject({
      title: "Meta",
      metricType: "PERCENTAGE",
      direction: "INCREASE",
      startValue: 40,
      targetValue: 70,
    });
  });

  it("creates a period inline when none is selected", () => {
    const payload = buildOrganizationalGoalCreate({
      ...emptyOrganizationalGoalForm(),
      title: "Facturación",
      metricType: "CURRENCY",
      targetValue: "1000000",
      currencyCode: "cop",
      newCycleName: "2026",
      newCycleStartDate: "2026-01-01",
      newCycleEndDate: "2026-12-31",
    });
    expect(payload.cycle).toEqual({
      name: "2026",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });
    expect(payload.keyResult.currencyCode).toBe("COP");
    expect(payload.keyResult.targetValue).toBe(1000000);
  });

  it("rejects a boolean goal without a period", () => {
    expect(() =>
      buildOrganizationalGoalCreate({
        ...emptyOrganizationalGoalForm(),
        title: "ISO",
        metricType: "BOOLEAN",
      }),
    ).toThrow(/periodo/);
  });
});
