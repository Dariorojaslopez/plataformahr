import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assertNoTokenLocalStorage,
  clearSession,
  getAccessToken,
  getActiveCompanyId,
  getRefreshToken,
  setActiveCompanyId,
  setSessionIdentity,
  setTokens,
} from "@/lib/auth/session-store";

describe("session-store", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    clearSession();
  });

  afterEach(() => {
    clearSession();
    sessionStorage.clear();
    localStorage.clear();
  });

  it("keeps access token in memory and refresh token in sessionStorage", () => {
    setTokens("access-1", "refresh-1");
    expect(getAccessToken()).toBe("access-1");
    expect(getRefreshToken()).toBe("refresh-1");
    expect(sessionStorage.getItem("tsc.refreshToken")).toBe("refresh-1");
    expect(localStorage.getItem("tsc.refreshToken")).toBeNull();
    expect(assertNoTokenLocalStorage()).toBe(true);
  });

  it("does not use localStorage for tokens", () => {
    setTokens("a", "r");
    setActiveCompanyId("company-1");
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      expect(key?.toLowerCase().includes("token")).toBeFalsy();
    }
  });

  it("clears session completely", () => {
    setTokens("a", "r");
    setSessionIdentity(
      {
        id: "u1",
        email: "a@b.com",
        firstName: "A",
        lastName: "B",
        isPlatformOwner: false,
      },
      [{ id: "c1", name: "Co", slug: "co" }],
    );
    setActiveCompanyId("c1");
    clearSession();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(getActiveCompanyId()).toBeNull();
  });
});
