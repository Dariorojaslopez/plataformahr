import { describe, expect, it } from "vitest";
import { PLATFORM_BRAND_PRIMARY } from "@/lib/company/brand-tokens";

describe("global login branding", () => {
  it("uses Plataforma HR primary, not a tenant color", () => {
    expect(PLATFORM_BRAND_PRIMARY).toBe("#0F5C5A");
  });
});
