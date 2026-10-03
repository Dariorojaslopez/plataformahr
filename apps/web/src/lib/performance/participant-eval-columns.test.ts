import { describe, expect, it } from "vitest";
import {
  extraEvalColumnApplies,
  formatExtraEvalColumn,
  NOT_APPLICABLE_EVAL_LABEL,
} from "@/lib/performance/participant-eval-columns";

describe("participant eval columns", () => {
  it("marks groups outside the model as not applicable", () => {
    expect(extraEvalColumnApplies("DEGREE_90", "peer")).toBe(false);
    expect(extraEvalColumnApplies("DEGREE_180", "peer")).toBe(true);
    expect(extraEvalColumnApplies("DEGREE_180", "report")).toBe(false);
    expect(extraEvalColumnApplies("DEGREE_180", "client")).toBe(false);
    expect(extraEvalColumnApplies("DEGREE_270", "report")).toBe(true);
    expect(extraEvalColumnApplies("DEGREE_270", "client")).toBe(false);
    expect(extraEvalColumnApplies("DEGREE_360", "client")).toBe(true);
    expect(NOT_APPLICABLE_EVAL_LABEL).toBe("No aplica");
  });

  it("summarizes an applicable group", () => {
    expect(formatExtraEvalColumn(undefined)).toBe("—");
    expect(
      formatExtraEvalColumn({
        total: 2,
        submitted: 0,
        inProgress: 0,
        pending: 2,
        averageScore: null,
      }),
    ).toBe("Pendiente");
    expect(
      formatExtraEvalColumn({
        total: 3,
        submitted: 1,
        inProgress: 1,
        pending: 1,
        averageScore: "80.00",
      }),
    ).toBe("1/3 enviadas");
    expect(
      formatExtraEvalColumn({
        total: 2,
        submitted: 2,
        inProgress: 0,
        pending: 0,
        averageScore: "90.00",
      }),
    ).toBe("Enviada (90.00%)");
  });
});