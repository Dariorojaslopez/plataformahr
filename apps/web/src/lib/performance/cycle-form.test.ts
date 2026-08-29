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
  goalDefinitionStartDate: "",
  goalDefinitionEndDate: "",
  managerEvaluationStartDate: "",
  managerEvaluationEndDate: "",
  calibrationStartDate: "",
  calibrationEndDate: "",
  closingStartDate: "",
  closingEndDate: "",
  followUps: [],
  evaluationModel: "DEGREE_90",
  selfEvaluationWeight: "30",
  managerEvaluationWeight: "70",
  peerEvaluationWeight: "0",
  reportEvaluationWeight: "0",
  clientEvaluationWeight: "0",
  includeCompetencies: true,
  goalCycleId: "",
  competencyResultWeight: "70",
  organizationalGoalsWeight: "0",
  individualGoalsWeight: "0",
  maxObjectives: "",
  evaluationRange: "100",
};

const integratedForm: CycleFormState = {
  ...baseForm,
  goalCycleId: "goal-cycle-1",
  competencyResultWeight: "60",
  organizationalGoalsWeight: "0",
  individualGoalsWeight: "40",
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
      evaluationModel: "DEGREE_90",
      selfEvaluationWeight: 30,
      managerEvaluationWeight: 70,
      peerEvaluationWeight: null,
      reportEvaluationWeight: null,
      clientEvaluationWeight: null,
      includeCompetencies: true,
      evaluationRange: 100,
    });
  });

  it("omits goals composition on create when goal weights are 0", () => {
    const payload = buildCreateCyclePayload(baseForm);
    expect(payload.goalCycleId).toBeUndefined();
    expect(payload.competencyResultWeight).toBeUndefined();
    expect(payload.goalsResultWeight).toBeUndefined();
  });

  it("includes goals composition on create when goal weights are set", () => {
    expect(buildCreateCyclePayload(integratedForm)).toMatchObject({
      name: "Ciclo 2026",
      goalCycleId: "goal-cycle-1",
      competencyResultWeight: 60,
      organizationalGoalsWeight: 0,
      individualGoalsWeight: 40,
      goalsResultWeight: 40,
      includeCompetencies: true,
      evaluationRange: 100,
    });
  });

  it("includes 180° peer weight and follow-ups", () => {
    const payload = buildCreateCyclePayload({
      ...baseForm,
      evaluationModel: "DEGREE_180",
      selfEvaluationWeight: "20",
      managerEvaluationWeight: "50",
      peerEvaluationWeight: "30",
      followUps: [{ startDate: "2026-03-01", endDate: "2026-03-15" }],
    });
    expect(payload.evaluationModel).toBe("DEGREE_180");
    expect(payload.peerEvaluationWeight).toBe(30);
    expect(payload.followUps).toEqual([
      { startDate: "2026-03-01", endDate: "2026-03-15" },
    ]);
  });

  it("omits empty optional fields on create", () => {
    expect(
      buildCreateCyclePayload({
        ...baseForm,
        description: "  ",
        evaluationStartDate: "",
        evaluationEndDate: "",
      }),
    ).toMatchObject({
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
    ).toMatchObject({
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

  it("clears goals composition on update when goal weights are 0", () => {
    expect(buildUpdateCyclePayload(baseForm)).toMatchObject({
      goalCycleId: null,
      competencyResultWeight: null,
      goalsResultWeight: null,
    });
  });

  it("defaults empty form weights to 30/70 and competencias on", () => {
    const empty = emptyCycleForm();
    expect(empty.selfEvaluationWeight).toBe("30");
    expect(empty.managerEvaluationWeight).toBe("70");
    expect(empty.includeCompetencies).toBe(true);
    expect(empty.evaluationModel).toBe("DEGREE_90");
    expect(empty.competencyResultWeight).toBe("70");
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
      goalDefinitionStartDate: null,
      goalDefinitionEndDate: null,
      managerEvaluationStartDate: null,
      managerEvaluationEndDate: null,
      calibrationStartDate: null,
      calibrationEndDate: null,
      closingStartDate: null,
      closingEndDate: null,
      evaluationModel: "DEGREE_90",
      selfEvaluationWeight: "30.00",
      managerEvaluationWeight: "70.00",
      peerEvaluationWeight: null,
      reportEvaluationWeight: null,
      clientEvaluationWeight: null,
      includeCompetencies: true,
      goalCycleId: "gc1",
      competencyResultWeight: "65.00",
      goalsResultWeight: "35.00",
      organizationalGoalsWeight: "0.00",
      individualGoalsWeight: "35.00",
      maxObjectives: 6,
      evaluationRange: 100,
      followUps: [],
      status: "DRAFT",
      createdByUserId: "u1",
      createdAt: "",
      updatedAt: "",
    } satisfies PerformanceCycle;

    expect(cycleFormFromPerformanceCycle(cycle)).toMatchObject({
      includeCompetencies: true,
      goalCycleId: "gc1",
      competencyResultWeight: "65.00",
      individualGoalsWeight: "35.00",
      maxObjectives: "6",
    });
  });

  it("validates goals composition requires cycle and stays within range", () => {
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
        individualGoalsWeight: "50",
      }),
    ).toBe(false);
    expect(cycleGoalsCompositionIsValid(integratedForm)).toBe(true);
    expect(
      cycleGoalsCompositionIsValid({
        ...integratedForm,
        evaluationRange: "120",
        competencyResultWeight: "70",
        organizationalGoalsWeight: "20",
        individualGoalsWeight: "30",
      }),
    ).toBe(true);
  });

  it("throws when integrated create exceeds the evaluation range", () => {
    expect(() =>
      buildCreateCyclePayload({
        ...integratedForm,
        individualGoalsWeight: "50",
      }),
    ).toThrow(/no puede superar 100%/);
  });
});
