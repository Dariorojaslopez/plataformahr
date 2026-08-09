import { describe, expect, it } from "vitest";
import {
  COMPOSITION_LABELS,
  compositionSummaryLabel,
  isIntegratedComposition,
} from "@/lib/performance/composition-labels";

describe("composition labels", () => {
  it("maps composition types to Spanish labels", () => {
    expect(COMPOSITION_LABELS.COMPETENCY_ONLY).toBe("Solo competencias");
    expect(COMPOSITION_LABELS.COMPETENCY_AND_GOALS).toBe(
      "Competencias + objetivos",
    );
  });

  it("detects integrated composition", () => {
    expect(isIntegratedComposition("COMPETENCY_ONLY")).toBe(false);
    expect(isIntegratedComposition("COMPETENCY_AND_GOALS")).toBe(true);
    expect(isIntegratedComposition(undefined)).toBe(false);
    expect(isIntegratedComposition(null)).toBe(false);
  });

  it("summarizes composition for display", () => {
    expect(compositionSummaryLabel("COMPETENCY_ONLY")).toBe("Solo competencias");
    expect(compositionSummaryLabel("COMPETENCY_AND_GOALS")).toBe(
      "Competencias + objetivos",
    );
    expect(compositionSummaryLabel(undefined)).toBe("Solo competencias");
  });
});
