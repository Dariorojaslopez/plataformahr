import { describe, expect, it } from "vitest";
import type { GoalDefinitionScale } from "@/types/performance";
import {
  formatGoalTarget,
  goalTargetHint,
  goalTargetPrefix,
  goalTargetSuffix,
  hasIndividualGoalTarget,
  parseGoalTargetValue,
} from "@/lib/performance/goal-target";

const currencyScale: GoalDefinitionScale = {
  id: "cur",
  name: "Objetivos - Moneda",
  kind: "QUANTITATIVE",
  format: "CURRENCY",
  minValue: null,
  maxValue: null,
  currencyCode: "COP",
  decimalPlaces: 2,
  levels: [],
};

const percentScale: GoalDefinitionScale = {
  id: "pct",
  name: "Desempeño",
  kind: "QUANTITATIVE",
  format: "PERCENTAGE",
  minValue: "0.00",
  maxValue: "100.00",
  currencyCode: null,
  decimalPlaces: null,
  levels: [],
};

const qualitativeScale: GoalDefinitionScale = {
  id: "qual",
  name: "Competencias",
  kind: "QUALITATIVE",
  format: "DESCRIPTIVE",
  minValue: "1.00",
  maxValue: "3.00",
  currencyCode: null,
  decimalPlaces: null,
  levels: [
    { id: "a", value: 1, label: "Bajo", order: 1 },
    { id: "b", value: 2, label: "Alto", order: 2 },
  ],
};

describe("goal target helpers", () => {
  it("parses numeric meta and requires the matching input", () => {
    expect(parseGoalTargetValue("50.000.000")).toBeNull();
    expect(parseGoalTargetValue("50000000")).toBe(50_000_000);
    expect(hasIndividualGoalTarget(currencyScale, "50000000", "")).toBe(true);
    expect(hasIndividualGoalTarget(percentScale, "", "")).toBe(false);
    expect(hasIndividualGoalTarget(qualitativeScale, "10", "b")).toBe(true);
    expect(hasIndividualGoalTarget(qualitativeScale, "10", "")).toBe(false);
  });

  it("adapts prefix, suffix and hint to the scale", () => {
    expect(goalTargetPrefix(currencyScale)).toBe("COP");
    expect(goalTargetSuffix(percentScale)).toBe("%");
    expect(goalTargetHint(currencyScale)).toContain("COP");
    expect(goalTargetHint(percentScale)).toContain("0");
    expect(goalTargetHint(qualitativeScale)).toContain("Nivel esperado");
    expect(goalTargetHint(undefined)).toContain("Selecciona una escala");
  });

  it("formats stored meta for read-only views", () => {
    expect(
      formatGoalTarget({
        targetValue: "50000000.00",
        targetScaleLevel: null,
        scale: { format: "CURRENCY", currencyCode: "COP" },
      }),
    ).toContain("COP");
    expect(
      formatGoalTarget({
        targetValue: null,
        targetScaleLevel: { label: "Alto" },
      }),
    ).toBe("Alto");
  });
});
