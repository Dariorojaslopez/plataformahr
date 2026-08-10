import { beforeEach, describe, expect, it } from "vitest";
import {
  assertNoTokenWebStorage,
  clearSession,
  getAccessToken,
  getSessionSnapshot,
  setAccessToken,
  setActiveCompanyId,
  setSessionIdentity,
} from "@/lib/auth/session-store";

describe("session-store", () => {
  beforeEach(() => {
    clearSession();
    sessionStorage.clear();
    localStorage.clear();
  });

  it("keeps access token in memory only", () => {
    setAccessToken("access-1");
    expect(getAccessToken()).toBe("access-1");
    expect(sessionStorage.getItem("tsc.refreshToken")).toBeNull();
    expect(localStorage.getItem("tsc.refreshToken")).toBeNull();
    expect(assertNoTokenWebStorage()).toBe(true);
  });

  it("does not persist refresh tokens in Web Storage", () => {
    setAccessToken("access-2");
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      expect(key?.toLowerCase().includes("token") ?? false).toBe(false);
    }
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      expect(key?.toLowerCase().includes("token") ?? false).toBe(false);
    }
  });

  it("clears legacy refreshToken sessionStorage key", () => {
    sessionStorage.setItem("tsc.refreshToken", "legacy");
    clearSession();
    expect(sessionStorage.getItem("tsc.refreshToken")).toBeNull();
  });

  it("snapshot has no refreshToken field", () => {
    setAccessToken("a");
    setSessionIdentity(
      {
        id: "u1",
        email: "a@b.c",
        firstName: "A",
        lastName: "B",
        isPlatformOwner: false,
      },
      [],
    );
    setActiveCompanyId(null);
    const snap = getSessionSnapshot();
    expect(snap).not.toHaveProperty("refreshToken");
    expect(snap.accessToken).toBe("a");
  });

  it("returns a stable snapshot reference between updates (useSyncExternalStore)", () => {
    const a = getSessionSnapshot();
    const b = getSessionSnapshot();
    expect(a).toBe(b);

    setAccessToken("token");
    const c = getSessionSnapshot();
    expect(c).not.toBe(a);
    expect(getSessionSnapshot()).toBe(c);
  });
});
