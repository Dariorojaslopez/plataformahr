import { describe, expect, it } from "vitest";
import {
  buildCreateCyclePayload,
  buildUpdateCyclePayload,
  cycleFormFromPerformanceCycle,
  cycleGoalsCompositionIsValid,
  emptyCycleForm,
  type CycleFormState,
} from "@/lib/performance/cycle-form";
import type { PerformanceCycle } from "@/types/performance";

const baseForm: CycleFormState = {
  name: "  Ciclo 2026  ",
  description: "  Anual  ",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  evaluationStartDate: "2026-11-01",
  evaluationEndDate: "2026-12-15",
  selfEvaluationWeight: "30",
  managerEvaluationWeight: "70",
  includeGoals: false,
  goalCycleId: "",
  competencyResultWeight: "70",
  goalsResultWeight: "30",
};

const integratedForm: CycleFormState = {
  ...baseForm,
  includeGoals: true,
  goalCycleId: "goal-cycle-1",
  competencyResultWeight: "60",
  goalsResultWeight: "40",
};

describe("cycle form payloads", () => {
  it("builds create payload with trimmed dates, weights and optional fields", () => {
    expect(buildCreateCyclePayload(baseForm)).toEqual({
      name: "Ciclo 2026",
      description: "Anual",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      evaluationStartDate: "2026-11-01",
      evaluationEndDate: "2026-12-15",
      selfEvaluationWeight: 30,
      managerEvaluationWeight: 70,
    });
  });

  it("omits goals composition on create when disabled", () => {
    const payload = buildCreateCyclePayload(baseForm);
    expect(payload.goalCycleId).toBeUndefined();
    expect(payload.competencyResultWeight).toBeUndefined();
    expect(payload.goalsResultWeight).toBeUndefined();
  });

  it("includes goals composition on create when enabled", () => {
    expect(buildCreateCyclePayload(integratedForm)).toEqual({
      name: "Ciclo 2026",
      description: "Anual",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      evaluationStartDate: "2026-11-01",
      evaluationEndDate: "2026-12-15",
      selfEvaluationWeight: 30,
      managerEvaluationWeight: 70,
      goalCycleId: "goal-cycle-1",
      competencyResultWeight: 60,
      goalsResultWeight: 40,
    });
  });

  it("omits empty optional fields on create", () => {
    expect(
      buildCreateCyclePayload({
        ...baseForm,
        description: "  ",
        evaluationStartDate: "",
        evaluationEndDate: "",
      }),
    ).toEqual({
      name: "Ciclo 2026",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      selfEvaluationWeight: 30,
      managerEvaluationWeight: 70,
    });
  });

  it("sends null for cleared optional fields on update and includes weights", () => {
    expect(
      buildUpdateCyclePayload({
        ...baseForm,
        description: "",
        evaluationStartDate: "",
        evaluationEndDate: "",
        selfEvaluationWeight: "20",
        managerEvaluationWeight: "80",
      }),
    ).toEqual({
      name: "Ciclo 2026",
      description: null,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      evaluationStartDate: null,
      evaluationEndDate: null,
      selfEvaluationWeight: 20,
      managerEvaluationWeight: 80,
      goalCycleId: null,
      competencyResultWeight: null,
      goalsResultWeight: null,
    });
  });

  it("clears goals composition on update when disabled", () => {
    expect(buildUpdateCyclePayload(baseForm)).toMatchObject({
      goalCycleId: null,
      competencyResultWeight: null,
      goalsResultWeight: null,
    });
  });

  it("defaults empty form weights to 30/70 and goals off", () => {
    const empty = emptyCycleForm();
    expect(empty.selfEvaluationWeight).toBe("30");
    expect(empty.managerEvaluationWeight).toBe("70");
    expect(empty.includeGoals).toBe(false);
    expect(empty.competencyResultWeight).toBe("70");
    expect(empty.goalsResultWeight).toBe("30");
  });

  it("maps cycle to form with goals integration", () => {
    const cycle = {
      id: "c1",
      companyId: "co1",
      name: "Ciclo",
      description: null,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      evaluationStartDate: null,
      evaluationEndDate: null,
      selfEvaluationWeight: "30.00",
      managerEvaluationWeight: "70.00",
      goalCycleId: "gc1",
      competencyResultWeight: "65.00",
      goalsResultWeight: "35.00",
      status: "DRAFT",
      createdByUserId: "u1",
      createdAt: "",
      updatedAt: "",
    } satisfies PerformanceCycle;

    expect(cycleFormFromPerformanceCycle(cycle)).toMatchObject({
      includeGoals: true,
      goalCycleId: "gc1",
      competencyResultWeight: "65.00",
      goalsResultWeight: "35.00",
    });
  });

  it("validates goals composition requires cycle and sum 100", () => {
    expect(cycleGoalsCompositionIsValid(baseForm)).toBe(true);
    expect(
      cycleGoalsCompositionIsValid({
        ...integratedForm,
        goalCycleId: "",
      }),
    ).toBe(false);
    expect(
      cycleGoalsCompositionIsValid({
        ...integratedForm,
        goalsResultWeight: "50",
      }),
    ).toBe(false);
    expect(cycleGoalsCompositionIsValid(integratedForm)).toBe(true);
  });

  it("throws when integrated create lacks valid composition", () => {
    expect(() =>
      buildCreateCyclePayload({
        ...integratedForm,
        goalsResultWeight: "30",
      }),
    ).toThrow(/sumar exactamente 100%/);
  });
});
