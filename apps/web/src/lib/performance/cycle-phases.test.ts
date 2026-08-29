import { describe, expect, it } from "vitest";
import {
  buildCyclePhases,
  canEditEvaluationInCyclePhase,
  canEditGoalsInCyclePhase,
  visibleCyclePhases,
} from "@/lib/performance/cycle-phases";

const base = {
  status: "ACTIVE" as const,
  startDate: "2026-01-01",
  endDate: "2026-12-31",
};

describe("cycle phases", () => {
  it("hides future phases and marks the window that contains today as current", () => {
    const phases = buildCyclePhases(
      {
        ...base,
        goalDefinitionStartDate: "2026-01-10",
        goalDefinitionEndDate: "2026-02-10",
        evaluationStartDate: "2026-03-01",
        evaluationEndDate: "2026-03-31",
        managerEvaluationStartDate: "2026-04-01",
        managerEvaluationEndDate: "2026-04-30",
        calibrationStartDate: "2026-05-01",
        calibrationEndDate: "2026-05-15",
      },
      "2026-03-15",
    );

    expect(phases.map((p) => [p.kind, p.visibility])).toEqual([
      ["GOAL_DEFINITION", "past"],
      ["SELF_EVALUATION", "current"],
      ["EVALUATION", "future"],
      ["CALIBRATION", "future"],
    ]);
    expect(visibleCyclePhases(phases).map((p) => p.kind)).toEqual([
      "GOAL_DEFINITION",
      "SELF_EVALUATION",
    ]);
  });

  it("treats a lone autoevaluación window as shared competency evaluation", () => {
    const phases = buildCyclePhases(
      {
        ...base,
        evaluationStartDate: "2026-06-01",
        evaluationEndDate: "2026-06-30",
      },
      "2026-06-10",
    );
    expect(phases).toHaveLength(1);
    expect(phases[0].kind).toBe("COMPETENCY_EVALUATION");
    expect(phases[0].visibility).toBe("current");
    expect(
      canEditEvaluationInCyclePhase({
        cycleStatus: "ACTIVE",
        evaluationType: "SELF",
        phases,
      }),
    ).toBe(true);
    expect(
      canEditEvaluationInCyclePhase({
        cycleStatus: "ACTIVE",
        evaluationType: "MANAGER",
        phases,
      }),
    ).toBe(true);
  });

  it("blocks editing when the cycle is not ACTIVE", () => {
    const phases = buildCyclePhases(
      {
        ...base,
        status: "CLOSED",
        evaluationStartDate: "2026-06-01",
        evaluationEndDate: "2026-06-30",
      },
      "2026-06-10",
    );
    expect(
      canEditEvaluationInCyclePhase({
        cycleStatus: "CLOSED",
        evaluationType: "SELF",
        phases,
      }),
    ).toBe(false);
  });

  it("allows goal check-ins only in the current follow-up of an ACTIVE cycle", () => {
    const phases = buildCyclePhases(
      {
        ...base,
        followUps: [
          { order: 0, startDate: "2026-02-01", endDate: "2026-02-15" },
          { order: 1, startDate: "2026-05-01", endDate: "2026-05-15" },
        ],
      },
      "2026-05-08",
    );
    expect(phases[0].visibility).toBe("past");
    expect(phases[1].visibility).toBe("current");
    expect(
      canEditGoalsInCyclePhase({
        cycleStatus: "ACTIVE",
        phases,
        kind: "FOLLOW_UP",
      }),
    ).toBe(true);
    expect(
      canEditGoalsInCyclePhase({
        cycleStatus: "ACTIVE",
        phases,
        kind: "GOAL_DEFINITION",
      }),
    ).toBe(false);
  });

  it("allows competency edits when no evaluation windows are configured", () => {
    const phases = buildCyclePhases(base, "2026-06-01");
    expect(phases).toHaveLength(0);
    expect(
      canEditEvaluationInCyclePhase({
        cycleStatus: "ACTIVE",
        evaluationType: "SELF",
        phases,
      }),
    ).toBe(true);
  });
});
