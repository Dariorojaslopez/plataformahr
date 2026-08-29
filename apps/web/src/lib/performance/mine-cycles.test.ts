import { describe, expect, it } from "vitest";
import {
  groupMineEvaluationsByCycle,
  workspacePhases,
} from "@/lib/performance/mine-cycles";
import type { MineEvaluation } from "@/types/performance";

function evalItem(
  overrides: Partial<MineEvaluation> & Pick<MineEvaluation, "id" | "type" | "cycleId">,
): MineEvaluation {
  return {
    companyId: "co",
    participantId: "p",
    employeeId: "e",
    evaluatorEmployeeId: "e",
    status: "PENDING",
    createdAt: "",
    updatedAt: "",
    cycle: {
      id: overrides.cycleId,
      name: "Ciclo anual",
      status: "ACTIVE",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      evaluationStartDate: "2026-03-01",
      evaluationEndDate: "2026-03-31",
      goalDefinitionStartDate: null,
      goalDefinitionEndDate: null,
      managerEvaluationStartDate: null,
      managerEvaluationEndDate: null,
      calibrationStartDate: null,
      calibrationEndDate: null,
      closingStartDate: null,
      closingEndDate: null,
      goalCycleId: null,
      followUps: [],
    },
    employee: {
      id: "e",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
    },
    evaluatorEmployee: null,
    ...overrides,
  };
}

describe("groupMineEvaluationsByCycle", () => {
  it("groups self and other evaluations under the cycle name", () => {
    const groups = groupMineEvaluationsByCycle(
      {
        self: [evalItem({ id: "s1", type: "SELF", cycleId: "c1" })],
        asManager: [
          evalItem({
            id: "m1",
            type: "MANAGER",
            cycleId: "c1",
            employeeId: "other",
          }),
        ],
      },
      "2026-03-10",
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("Ciclo anual");
    expect(groups[0].self).toHaveLength(1);
    expect(groups[0].others).toHaveLength(1);
    expect(groups[0].currentPhase?.kind).toBe("COMPETENCY_EVALUATION");
    expect(groups[0].editable).toBe(true);
  });

  it("sorts active cycles first", () => {
    const groups = groupMineEvaluationsByCycle(
      {
        self: [
          evalItem({
            id: "s2",
            type: "SELF",
            cycleId: "c-closed",
            cycle: {
              id: "c-closed",
              name: "Cerrado",
              status: "CLOSED",
              startDate: "2025-01-01",
              endDate: "2025-12-31",
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
              goalCycleId: null,
              followUps: [],
            },
          }),
          evalItem({ id: "s1", type: "SELF", cycleId: "c1" }),
        ],
        asManager: [],
      },
      "2026-03-10",
    );
    expect(groups.map((g) => g.cycleId)).toEqual(["c1", "c-closed"]);
    expect(groups[1].editable).toBe(false);
  });
});

describe("workspacePhases", () => {
  it("synthesizes an evaluation phase for legacy cycles without windows", () => {
    const groups = groupMineEvaluationsByCycle(
      {
        self: [
          evalItem({
            id: "s1",
            type: "SELF",
            cycleId: "legacy",
            cycle: {
              id: "legacy",
              name: "Legado",
              status: "ACTIVE",
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
              goalCycleId: null,
              followUps: [],
            },
          }),
        ],
        asManager: [],
      },
      "2026-06-01",
    );
    expect(groups[0].phases).toHaveLength(0);
    expect(workspacePhases(groups[0]).map((p) => p.kind)).toEqual([
      "COMPETENCY_EVALUATION",
    ]);
    expect(workspacePhases(groups[0])[0].visibility).toBe("current");
  });
});
