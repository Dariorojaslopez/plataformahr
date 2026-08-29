import { describe, expect, it } from "vitest";
import {
  autoQualitativeScaleId,
  COMPETENCY_SCALE_KIND_LABELS,
  isQualitativeCompetencyScale,
  qualitativeScalesForRating,
} from "@/lib/performance/scale-kind";

describe("competency scale kind", () => {
  it("treats missing kind as qualitative", () => {
    expect(isQualitativeCompetencyScale(undefined)).toBe(true);
    expect(isQualitativeCompetencyScale("QUALITATIVE")).toBe(true);
    expect(isQualitativeCompetencyScale("QUANTITATIVE")).toBe(false);
  });

  it("keeps only qualitative scales for competency rating", () => {
    const scales = [
      { id: "q", kind: "QUALITATIVE" as const },
      { id: "n", kind: "QUANTITATIVE" as const },
      { id: "legacy" },
    ];
    expect(qualitativeScalesForRating(scales).map((item) => item.id)).toEqual([
      "q",
      "legacy",
    ]);
  });

  it("auto-selects the scale when there is exactly one qualitative option", () => {
    expect(autoQualitativeScaleId([{ id: "only" }])).toBe("only");
    expect(autoQualitativeScaleId([{ id: "a" }, { id: "b" }])).toBe("");
    expect(COMPETENCY_SCALE_KIND_LABELS.QUANTITATIVE).toBe("Cuantitativa");
  });
});
