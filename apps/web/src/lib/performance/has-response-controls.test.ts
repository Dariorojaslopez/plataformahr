import { describe, expect, it } from "vitest";
import { hasEvaluationResponseControls } from "@/lib/performance/has-response-controls";

describe("has response controls", () => {
  it("is false without evaluation context and true when editable", () => {
    expect(hasEvaluationResponseControls()).toBe(false);
    expect(hasEvaluationResponseControls({ editable: true })).toBe(true);
  });
});
