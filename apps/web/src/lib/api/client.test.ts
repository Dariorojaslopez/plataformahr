import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiRequest,
  refreshAccessToken,
  registerRefreshHandler,
  runSingleFlightRefresh,
} from "@/lib/api/client";
import {
  clearSession,
  getAccessToken,
  setAccessToken,
  setActiveCompanyId,
} from "@/lib/auth/session-store";
import { ApiError } from "@/lib/api/errors";

describe("api client", () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearSession();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
    registerRefreshHandler(refreshAccessToken);
  });

  it("adds Authorization and X-Company-Id headers", async () => {
    setAccessToken("token-abc");
    setActiveCompanyId("company-xyz");

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await apiRequest<{ ok: boolean }>("/auth/me");

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/auth/me",
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({
          Authorization: "Bearer token-abc",
          "X-Company-Id": "company-xyz",
        }) as HeadersInit,
      }),
    );
  });

  it("omits company header when companyId is null", async () => {
    setAccessToken("token-abc");
    setActiveCompanyId("company-xyz");

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await apiRequest("/auth/logout", { method: "POST", companyId: null });

    const init = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer token-abc");
    expect(headers["X-Company-Id"]).toBeUndefined();
  });

  it("refresh single-flight shares one promise", async () => {
    let resolveRefresh!: (value: boolean) => void;
    const deferred = new Promise<boolean>((resolve) => {
      resolveRefresh = resolve;
    });
    let calls = 0;
    registerRefreshHandler(async () => {
      calls += 1;
      return deferred;
    });

    const p1 = runSingleFlightRefresh();
    const p2 = runSingleFlightRefresh();
    expect(calls).toBe(1);
    resolveRefresh(true);
    await expect(Promise.all([p1, p2])).resolves.toEqual([true, true]);
  });

  it("clears session when refresh fails after 401", async () => {
    setAccessToken("expired");
    registerRefreshHandler(async () => false);

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(apiRequest("/companies/current")).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(getAccessToken()).toBeNull();
  });
});
