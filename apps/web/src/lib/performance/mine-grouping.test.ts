import { describe, expect, it } from "vitest";
import {
  countMineEvaluations,
  formatMineSectionTitle,
} from "@/lib/performance/mine-grouping";

describe("mine grouping", () => {
  it("counts already-grouped API sections", () => {
    expect(countMineEvaluations(undefined)).toEqual({
      self: 0,
      asManager: 0,
      total: 0,
    });
    expect(
      countMineEvaluations({
        self: [{ id: "1" } as never, { id: "2" } as never],
        asManager: [{ id: "3" } as never],
      }),
    ).toEqual({ self: 2, asManager: 1, total: 3 });
  });

  it("formats section titles in Spanish", () => {
    expect(formatMineSectionTitle("self", 1)).toBe("1 autoevaluación");
    expect(formatMineSectionTitle("self", 2)).toBe("2 autoevaluaciones");
    expect(formatMineSectionTitle("asManager", 1)).toBe(
      "1 evaluación a realizar",
    );
    expect(formatMineSectionTitle("asManager", 0)).toBe(
      "0 evaluaciones a realizar",
    );
  });
});
