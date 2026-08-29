import { describe, expect, it } from "vitest";
import { formatCop } from "@/lib/platform/billing";

describe("billing format", () => {
  it("formats COP amounts with two decimals", () => {
    expect(formatCop("120000.00")).toMatch(/120\.000/);
  });
});
