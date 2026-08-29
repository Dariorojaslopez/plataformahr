import { describe, expect, it } from "vitest";
import {
  DEFAULT_COMPETENCY_RESULT_WEIGHT,
  DEFAULT_GOALS_RESULT_WEIGHT,
  formatResultCompositionWeightLabel,
  parseResultCompositionWeightInput,
  resultCompositionWeightsAreValid,
} from "@/lib/performance/result-composition-weights";

describe("result composition weights", () => {
  it("defaults to 70/30", () => {
    expect(DEFAULT_COMPETENCY_RESULT_WEIGHT).toBe(70);
    expect(DEFAULT_GOALS_RESULT_WEIGHT).toBe(30);
    expect(
      resultCompositionWeightsAreValid(
        DEFAULT_COMPETENCY_RESULT_WEIGHT,
        DEFAULT_GOALS_RESULT_WEIGHT,
      ),
    ).toBe(true);
  });

  it("allows sum below the range when three weights are provided", () => {
    expect(resultCompositionWeightsAreValid(70, 10, 10, 100)).toBe(true);
    expect(resultCompositionWeightsAreValid(70, 30, 30, 100)).toBe(false);
    expect(resultCompositionWeightsAreValid(70, 20, 30, 120)).toBe(true);
  });

  it("rejects out-of-range or incomplete inputs", () => {
    expect(resultCompositionWeightsAreValid(-1, 101)).toBe(false);
    expect(resultCompositionWeightsAreValid("", 30)).toBe(false);
    expect(resultCompositionWeightsAreValid(70, null)).toBe(false);
    expect(parseResultCompositionWeightInput("70.00")).toBe(70);
    expect(parseResultCompositionWeightInput("abc")).toBeNull();
  });

  it("formats display label", () => {
    expect(formatResultCompositionWeightLabel("70.00", "30.00")).toBe(
      "Competencias 70.00% · Objetivos 30.00%",
    );
  });
});
