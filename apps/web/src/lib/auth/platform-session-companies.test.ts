import { describe, expect, it, vi } from "vitest";
import { resolveSelectableCompanies } from "@/lib/auth/platform-session-companies";

const membership = [{ id: "m1", name: "Plataforma HR", slug: "plataforma-hr" }];
const catalog = [
  { id: "m1", name: "Plataforma HR", slug: "plataforma-hr" },
  { id: "m2", name: "Otra SAS", slug: "otra-sas" },
];

describe("resolveSelectableCompanies", () => {
  it("keeps memberships for regular users", async () => {
    const loadPlatformCompanies = vi.fn();
    await expect(
      resolveSelectableCompanies({
        user: { isPlatformOwner: false },
        membershipCompanies: membership,
        loadPlatformCompanies,
      }),
    ).resolves.toEqual(membership);
    expect(loadPlatformCompanies).not.toHaveBeenCalled();
  });

  it("loads every active tenant for a platform owner even with one membership", async () => {
    await expect(
      resolveSelectableCompanies({
        user: { isPlatformOwner: true },
        membershipCompanies: membership,
        loadPlatformCompanies: async () => catalog,
      }),
    ).resolves.toEqual(catalog);
  });

  it("falls back to memberships if the platform catalog fails", async () => {
    await expect(
      resolveSelectableCompanies({
        user: { isPlatformOwner: true },
        membershipCompanies: membership,
        loadPlatformCompanies: async () => {
          throw new Error("network");
        },
      }),
    ).resolves.toEqual(membership);
  });
});
