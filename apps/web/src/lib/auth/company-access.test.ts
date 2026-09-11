import { describe, expect, it, vi } from "vitest";
import {
  canFetchCompanyAccess,
  fetchCompanyAccessWithRetry,
} from "./company-access";

const access = { homeRole: "ADMIN" };

describe("canFetchCompanyAccess", () => {
  it("loads access only when authenticated, a company is selected, and the password is current", () => {
    expect(canFetchCompanyAccess(true, "company-1", false)).toBe(true);
    expect(canFetchCompanyAccess(false, "company-1", false)).toBe(false);
    expect(canFetchCompanyAccess(true, null, false)).toBe(false);
    expect(canFetchCompanyAccess(true, "company-1", true)).toBe(false);
  });
});

describe("fetchCompanyAccessWithRetry", () => {
  it("returns the first successful response", async () => {
    const request = vi.fn().mockResolvedValue(access);
    await expect(fetchCompanyAccessWithRetry(request, [0])).resolves.toBe(access);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("retries after a failure and then succeeds", async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error("not ready"))
      .mockResolvedValue(access);
    await expect(
      fetchCompanyAccessWithRetry(request, [0, 0]),
    ).resolves.toBe(access);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("throws the last error when every attempt fails", async () => {
    const request = vi.fn().mockRejectedValue(new Error("down"));
    await expect(fetchCompanyAccessWithRetry(request, [0, 0])).rejects.toThrow(
      "down",
    );
    expect(request).toHaveBeenCalledTimes(2);
  });
});
