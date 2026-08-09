import { describe, expect, it } from "vitest";
import { goalKeys } from "@/lib/api/goals";

describe("goal query keys", () => {
  it("scopes all keys by companyId", () => {
    expect(goalKeys.all("c1")[1]).toBe("c1");
    expect(goalKeys.cycles("c1", {})[1]).toBe("c1");
    expect(goalKeys.goal("c1", "g1")[1]).toBe("c1");
    expect(goalKeys.mine("a")).not.toEqual(goalKeys.mine("b"));
    expect(goalKeys.progress("a", "g1")[1]).toBe("a");
    expect(goalKeys.checkIns("a", "g1", "kr1")[1]).toBe("a");
    expect(goalKeys.team("a")[1]).toBe("a");
    expect(goalKeys.progress("a", "g1")).not.toEqual(
      goalKeys.progress("b", "g1"),
    );
    expect(goalKeys.team("a")).not.toEqual(goalKeys.team("b"));
  });
});
