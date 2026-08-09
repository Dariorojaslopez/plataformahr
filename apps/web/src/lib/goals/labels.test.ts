import { describe, expect, it } from "vitest";
import {
  DIRECTION_LABELS,
  GOAL_TYPE_LABELS,
  METRIC_TYPE_LABELS,
  formatKeyResultTarget,
} from "@/lib/goals/labels";
import {
  buildActivationChecklist,
  canActivateFromChecklist,
} from "@/lib/goals/activation";
import type { Goal } from "@/types/goals";

describe("goals labels and activation", () => {
  it("has labels for types and metrics without TEAM", () => {
    expect(GOAL_TYPE_LABELS.INDIVIDUAL).toBeTruthy();
    expect(GOAL_TYPE_LABELS.AREA).toBeTruthy();
    expect(GOAL_TYPE_LABELS.COMPANY).toBeTruthy();
    expect(METRIC_TYPE_LABELS.BOOLEAN).toBeTruthy();
    expect(DIRECTION_LABELS.DECREASE).toBeTruthy();
  });

  it("formats targets by metric type", () => {
    expect(
      formatKeyResultTarget({
        metricType: "NUMBER",
        targetValue: "100",
        targetBoolean: null,
        unit: "clientes",
        currencyCode: null,
      }),
    ).toBe("100 clientes");
    expect(
      formatKeyResultTarget({
        metricType: "PERCENTAGE",
        targetValue: "95",
        targetBoolean: null,
        unit: null,
        currencyCode: null,
      }),
    ).toBe("95 %");
    expect(
      formatKeyResultTarget({
        metricType: "CURRENCY",
        targetValue: "50000000",
        targetBoolean: null,
        unit: null,
        currencyCode: "COP",
      }),
    ).toBe("COP 50000000");
    expect(
      formatKeyResultTarget({
        metricType: "BOOLEAN",
        targetValue: null,
        targetBoolean: true,
        unit: null,
        currencyCode: null,
      }),
    ).toBe("Cumplir");
  });

  it("builds activation checklist for individual goals", () => {
    const goal = {
      type: "INDIVIDUAL",
      areaId: null,
      keyResults: [{ weight: null }],
      assignments: [],
    } as unknown as Goal;
    const checks = buildActivationChecklist({
      goal,
      cycleStatus: "ACTIVE",
    });
    expect(canActivateFromChecklist(checks)).toBe(false);
    expect(checks.find((c) => c.key === "individual")?.ok).toBe(false);
  });

  it("has no progress or score controls in checklist", () => {
    const labels = buildActivationChecklist({
      goal: {
        type: "COMPANY",
        areaId: null,
        keyResults: [{ weight: "100" }],
        assignments: [],
      } as unknown as Goal,
      cycleStatus: "ACTIVE",
    })
      .map((c) => c.label.toLowerCase())
      .join(" ");
    expect(labels).not.toContain("progreso");
    expect(labels).not.toContain("score");
    expect(labels).not.toContain("performance");
  });
});
