import { describe, expect, it } from "vitest";
import {
  buildCreateCyclePayload,
  buildUpdateCyclePayload,
  emptyCycleForm,
  type CycleFormState,
} from "@/lib/performance/cycle-form";

const baseForm: CycleFormState = {
  name: "  Ciclo 2026  ",
  description: "  Anual  ",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  evaluationStartDate: "2026-11-01",
  evaluationEndDate: "2026-12-15",
  selfEvaluationWeight: "30",
  managerEvaluationWeight: "70",
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
    });
  });

  it("defaults empty form weights to 30/70", () => {
    const empty = emptyCycleForm();
    expect(empty.selfEvaluationWeight).toBe("30");
    expect(empty.managerEvaluationWeight).toBe("70");
  });
});
