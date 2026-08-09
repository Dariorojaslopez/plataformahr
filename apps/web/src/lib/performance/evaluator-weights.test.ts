import { describe, expect, it } from "vitest";
import {
  DEFAULT_MANAGER_EVALUATION_WEIGHT,
  DEFAULT_SELF_EVALUATION_WEIGHT,
  evaluatorWeightsAreValid,
  formatEvaluatorWeightLabel,
  parseEvaluatorWeightInput,
  sumEvaluatorWeights,
} from "@/lib/performance/evaluator-weights";

describe("evaluator weights", () => {
  it("defaults to 30/70", () => {
    expect(DEFAULT_SELF_EVALUATION_WEIGHT).toBe(30);
    expect(DEFAULT_MANAGER_EVALUATION_WEIGHT).toBe(70);
    expect(
      evaluatorWeightsAreValid(
        DEFAULT_SELF_EVALUATION_WEIGHT,
        DEFAULT_MANAGER_EVALUATION_WEIGHT,
      ),
    ).toBe(true);
  });

  it("requires sum exactly 100", () => {
    expect(evaluatorWeightsAreValid(30, 70)).toBe(true);
    expect(evaluatorWeightsAreValid("20", "80")).toBe(true);
    expect(evaluatorWeightsAreValid(0, 100)).toBe(true);
    expect(evaluatorWeightsAreValid(100, 0)).toBe(true);
    expect(evaluatorWeightsAreValid(40, 40)).toBe(false);
    expect(evaluatorWeightsAreValid(50, 60)).toBe(false);
    expect(sumEvaluatorWeights(30, 70)).toBe(100);
    expect(sumEvaluatorWeights(40, 40)).toBe(80);
  });

  it("rejects out-of-range or incomplete inputs", () => {
    expect(evaluatorWeightsAreValid(-1, 101)).toBe(false);
    expect(evaluatorWeightsAreValid(110, -10)).toBe(false);
    expect(evaluatorWeightsAreValid("", 70)).toBe(false);
    expect(evaluatorWeightsAreValid(30, null)).toBe(false);
    expect(parseEvaluatorWeightInput("30.00")).toBe(30);
    expect(parseEvaluatorWeightInput("abc")).toBeNull();
  });

  it("formats display label", () => {
    expect(formatEvaluatorWeightLabel("30.00", "70.00")).toBe(
      "Auto 30.00% · Líder 70.00%",
    );
  });
});
