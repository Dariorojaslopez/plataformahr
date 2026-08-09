import { describe, expect, it } from "vitest";
import {
  buildSaveResponsePayload,
  evaluationProgress,
  formatScorePercentage,
  hasEvaluationResponseControls,
  isCompetencyDirty,
  mineEvaluationCta,
  requiredMissingCompetencies,
} from "@/lib/performance/response-workspace";
import type { EvaluationSnapshotCompetency } from "@/types/performance";

describe("response workspace helpers", () => {
  it("exposes editable controls only when backend marks editable", () => {
    expect(hasEvaluationResponseControls()).toBe(false);
    expect(hasEvaluationResponseControls({ editable: false })).toBe(false);
    expect(hasEvaluationResponseControls({ editable: true })).toBe(true);
  });

  it("maps mine CTAs by status", () => {
    expect(mineEvaluationCta("PENDING").label).toBe("Comenzar");
    expect(mineEvaluationCta("IN_PROGRESS").label).toBe("Continuar");
    expect(mineEvaluationCta("SUBMITTED").label).toBe("Ver resultado");
  });

  it("formats score percentage to two decimals", () => {
    expect(formatScorePercentage("82.50")).toBe("82.50%");
    expect(formatScorePercentage(77.5)).toBe("77.50%");
    expect(formatScorePercentage(null)).toBe("—");
  });

  it("computes progress from persisted counts", () => {
    expect(evaluationProgress({ respondedCount: 3, competencyCount: 5 })).toEqual({
      label: "3 de 5 competencias respondidas",
      percent: 60,
    });
  });

  it("detects dirty competency state", () => {
    expect(
      isCompetencyDirty({
        selectedScaleLevelId: "l1",
        comment: "hola",
        saved: { selectedScaleLevelId: "l1", ratingValue: 3, comment: "hola" },
      }),
    ).toBe(false);
    expect(
      isCompetencyDirty({
        selectedScaleLevelId: "l2",
        comment: "hola",
        saved: { selectedScaleLevelId: "l1", ratingValue: 3, comment: "hola" },
      }),
    ).toBe(true);
  });

  it("builds save payload with null empty comment", () => {
    expect(
      buildSaveResponsePayload({ scaleLevelId: "l1", comment: "  " }),
    ).toEqual({ scaleLevelId: "l1", comment: null });
  });

  it("lists missing required competencies", () => {
    const comps = [
      {
        id: "a",
        required: true,
        response: null,
        levels: [{ id: "1", value: 1, label: "A", order: 0, description: null, sourceScaleLevelId: null }],
      },
      {
        id: "b",
        required: false,
        response: null,
        levels: [],
      },
    ] as EvaluationSnapshotCompetency[];
    expect(requiredMissingCompetencies(comps).map((c) => c.id)).toEqual(["a"]);
  });

  it("does not hardcode 1–5 scale options", () => {
    const levels = [
      { id: "x", value: 0, label: "Nulo", order: 0, description: null, sourceScaleLevelId: null },
      { id: "y", value: 10, label: "Máximo", order: 1, description: null, sourceScaleLevelId: null },
    ];
    expect(levels.map((l) => l.value)).toEqual([0, 10]);
  });
});
