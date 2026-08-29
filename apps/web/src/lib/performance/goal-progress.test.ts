import { describe, expect, it } from "vitest";
import {
  pdiStatusFromPercent,
  progressStatusFromPercent,
} from "@/lib/performance/goal-progress";

describe("goal progress helpers", () => {
  it("maps slider positions to Spanish workflow statuses", () => {
    expect(pdiStatusFromPercent(0)).toBe("NOT_STARTED");
    expect(pdiStatusFromPercent(40)).toBe("IN_PROGRESS");
    expect(pdiStatusFromPercent(100)).toBe("COMPLETED");
    expect(progressStatusFromPercent(100)).toBe("FINISHED");
  });
});
