import { describe, expect, it } from "vitest";
import {
  DEFAULT_COMPETENCY_RESULT_WEIGHT,
  DEFAULT_GOALS_RESULT_WEIGHT,
  formatResultCompositionWeightLabel,
  parseResultCompositionWeightInput,
  resultCompositionWeightsAreValid,
  sumResultCompositionWeights,
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

  it("requires sum exactly 100", () => {
    expect(resultCompositionWeightsAreValid(70, 30)).toBe(true);
    expect(resultCompositionWeightsAreValid("60", "40")).toBe(true);
    expect(resultCompositionWeightsAreValid(0, 100)).toBe(true);
    expect(resultCompositionWeightsAreValid(100, 0)).toBe(true);
    expect(resultCompositionWeightsAreValid(50, 40)).toBe(false);
    expect(sumResultCompositionWeights(70, 30)).toBe(100);
    expect(sumResultCompositionWeights(50, 40)).toBe(90);
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
