import { describe, expect, it } from "vitest";
import { canActivateWeights, sumWeights } from "@/lib/performance/weights";

describe("sumWeights", () => {
  it("returns null when all weights are null/empty", () => {
    expect(sumWeights([null, null, ""])).toBeNull();
  });

  it("sums numeric and string weights", () => {
    expect(sumWeights(["25.00", 25, "50.00"])).toBe(100);
  });
});

describe("canActivateWeights", () => {
  it("allows all-null weights", () => {
    expect(canActivateWeights([null, null])).toBe(true);
  });

  it("allows empty list", () => {
    expect(canActivateWeights([])).toBe(true);
  });

  it("requires sum 100 when any weight is set", () => {
    expect(canActivateWeights(["25.00", "25.00", "25.00", "25.00"])).toBe(
      true,
    );
    expect(canActivateWeights([50, 40])).toBe(false);
    expect(canActivateWeights([100, null])).toBe(false);
  });
});
