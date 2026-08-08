import { describe, expect, it } from "vitest";

/**
 * Pure routing decisions used after login — mirrors LoginForm behavior.
 */
function resolvePostLoginRoute(input: {
  isPlatformOwner: boolean;
  companiesCount: number;
}): "/platform" | "/dashboard" | "/select-company" {
  if (input.isPlatformOwner) return "/platform";
  if (input.companiesCount === 1) return "/dashboard";
  return "/select-company";
}

describe("post-login routing", () => {
  it("sends platform owner to /platform", () => {
    expect(
      resolvePostLoginRoute({ isPlatformOwner: true, companiesCount: 2 }),
    ).toBe("/platform");
  });

  it("auto-selects single company path to dashboard", () => {
    expect(
      resolvePostLoginRoute({ isPlatformOwner: false, companiesCount: 1 }),
    ).toBe("/dashboard");
  });

  it("sends multi-company users to select-company", () => {
    expect(
      resolvePostLoginRoute({ isPlatformOwner: false, companiesCount: 3 }),
    ).toBe("/select-company");
  });

  it("sends users without companies to select-company empty state", () => {
    expect(
      resolvePostLoginRoute({ isPlatformOwner: false, companiesCount: 0 }),
    ).toBe("/select-company");
  });
});
