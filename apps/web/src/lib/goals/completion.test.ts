import { describe, expect, it } from "vitest";
import {
  buildApprovePayload,
  buildRejectPayload,
  buildRequestCompletionPayload,
  estimatedAchievementLabel,
  finalAchievementLabel,
  formatAchievementPercent,
} from "@/lib/goals/completion";
import { goalKeys } from "@/lib/api/goals";

describe("goals completion helpers", () => {
  it("completion and result keys are tenant-aware", () => {
    expect(goalKeys.completionRequests("a", "g1")[1]).toBe("a");
    expect(goalKeys.result("a", "g1")[1]).toBe("a");
    expect(goalKeys.completionReviews("a")[1]).toBe("a");
    expect(goalKeys.result("a", "g1")).not.toEqual(goalKeys.result("b", "g1"));
  });

  it("request / approve / reject payloads", () => {
    expect(buildRequestCompletionPayload("  hola  ")).toEqual({
      requestComment: "hola",
    });
    expect(buildRequestCompletionPayload("   ")).toEqual({
      requestComment: null,
    });
    expect(buildApprovePayload(" ok ")).toEqual({ reviewComment: "ok" });
    expect(buildRejectPayload(" Falta evidencia ")).toEqual({
      reviewComment: "Falta evidencia",
    });
    expect(() => buildRejectPayload("  ")).toThrow(/obligatorio/i);
  });

  it("achievement labels avoid score wording", () => {
    expect(estimatedAchievementLabel().toLowerCase()).not.toContain("score");
    expect(finalAchievementLabel().toLowerCase()).not.toContain("score");
    expect(formatAchievementPercent("85.00")).toBe("85.00 %");
    expect(formatAchievementPercent(85)).toBe("85.00 %");
  });
});
