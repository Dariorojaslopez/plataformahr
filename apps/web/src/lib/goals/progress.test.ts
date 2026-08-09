import { describe, expect, it } from "vitest";
import {
  buildCheckInPayload,
  calculateGoalProgress,
  calculateKeyResultProgress,
  formatProgressPercent,
} from "@/lib/goals/progress";
import { safeHttpUrl } from "@/lib/ui/safe-url";

describe("goals progress helpers", () => {
  it("increase / decrease / boolean / overshoot", () => {
    expect(
      calculateKeyResultProgress({
        metricType: "NUMBER",
        direction: "INCREASE",
        startValue: 0,
        targetValue: 100,
        currentNumericValue: 60,
        currentBooleanValue: null,
        hasCheckIn: true,
      }),
    ).toBe(60);
    expect(
      calculateKeyResultProgress({
        metricType: "NUMBER",
        direction: "DECREASE",
        startValue: 10,
        targetValue: 2,
        currentNumericValue: 6,
        currentBooleanValue: null,
        hasCheckIn: true,
      }),
    ).toBe(50);
    expect(
      calculateKeyResultProgress({
        metricType: "NUMBER",
        direction: "INCREASE",
        startValue: 0,
        targetValue: 100,
        currentNumericValue: 120,
        currentBooleanValue: null,
        hasCheckIn: true,
      }),
    ).toBe(100);
    expect(
      calculateKeyResultProgress({
        metricType: "BOOLEAN",
        direction: null,
        startValue: null,
        targetValue: null,
        currentNumericValue: null,
        currentBooleanValue: true,
        hasCheckIn: true,
      }),
    ).toBe(100);
  });

  it("goal weighted and unweighted", () => {
    expect(
      calculateGoalProgress([
        { progressPercentage: 100, weight: null },
        { progressPercentage: 50, weight: null },
      ]),
    ).toBe(75);
    expect(
      calculateGoalProgress([
        { progressPercentage: 100, weight: 60 },
        { progressPercentage: 50, weight: 40 },
      ]),
    ).toBe(80);
  });

  it("check-in payloads by metric type", () => {
    expect(
      buildCheckInPayload({
        metricType: "NUMBER",
        numericText: "8.5",
        booleanValue: null,
        comment: "  ok  ",
        evidenceReference: "",
      }),
    ).toEqual({
      numericValue: 8.5,
      comment: "ok",
      evidenceReference: null,
    });
    expect(
      buildCheckInPayload({
        metricType: "PERCENTAGE",
        numericText: "12.5",
        booleanValue: null,
        comment: "",
        evidenceReference: "JIRA-1",
      }),
    ).toMatchObject({ numericValue: 12.5, evidenceReference: "JIRA-1" });
    expect(
      buildCheckInPayload({
        metricType: "CURRENCY",
        numericText: "12000000",
        booleanValue: null,
        comment: "",
        evidenceReference: "",
      }),
    ).toMatchObject({ numericValue: 12000000 });
    expect(
      buildCheckInPayload({
        metricType: "BOOLEAN",
        numericText: "",
        booleanValue: true,
        comment: "",
        evidenceReference: "",
      }),
    ).toMatchObject({ booleanValue: true });
  });

  it("evidence safe URL vs unsafe", () => {
    expect(safeHttpUrl("https://intranet.example/doc")).toMatch(/^https:/);
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,hi")).toBeNull();
    expect(safeHttpUrl("Informe comercial julio")).toBeNull();
  });

  it("progress label has no score wording", () => {
    expect(formatProgressPercent(60)).toBe("60 %");
    expect(formatProgressPercent(60).toLowerCase()).not.toContain("score");
  });
});
