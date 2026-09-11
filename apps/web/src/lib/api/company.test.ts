import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { companyApi, companyKeys } from "@/lib/api/company";
import { clearSession, setAccessToken, setActiveCompanyId } from "@/lib/auth/session-store";

describe("company branding API and keys", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    setAccessToken("token");
    setActiveCompanyId("company-a");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
  });

  it("scopes branding keys by company", () => {
    expect(companyKeys.branding("a")[1]).toBe("a");
    expect(companyKeys.branding("a")).not.toEqual(companyKeys.branding("b"));
    expect(companyKeys.logo("a", "t1")).not.toEqual(companyKeys.logo("a", "t2"));
    expect(companyKeys.logo("a", "t1")).not.toEqual(companyKeys.logo("b", "t1"));
  });

  it("fetches current-company branding with tenant header", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "company-a",
          name: "Acme",
          legalName: null,
          slug: "acme",
          brandPrimaryColor: null,
          hasLogo: false,
          logoUpdatedAt: null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await companyApi.getBranding();
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/companies/current/branding",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token",
          "X-Company-Id": "company-a",
        }) as HeadersInit,
      }),
    );
  });

  it("uploads a logo as multipart without JSON content-type", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "company-a",
          name: "Acme",
          legalName: null,
          slug: "acme",
          brandPrimaryColor: null,
          hasLogo: true,
          logoUpdatedAt: "2026-08-17T00:00:00.000Z",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );
    await companyApi.uploadLogo(new File(["x"], "logo.png", { type: "image/png" }));
    const init = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(init.body).toBeInstanceOf(FormData);
    expect(headers["Content-Type"]).toBeUndefined();
  });

  it("loads and saves role menus for the current company", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            catalog: [],
            roles: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            catalog: [],
            roles: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    await companyApi.getRoleMenus();
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/companies/current/role-menus",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token",
          "X-Company-Id": "company-a",
        }) as HeadersInit,
      }),
    );
    await companyApi.updateRoleMenus({
      roles: [{ roleCode: "LEADER", hrefs: ["/organization/org-chart"] }],
    });
    expect(fetch).toHaveBeenLastCalledWith(
      "http://localhost:3001/companies/current/role-menus",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("uploads an ATS template as multipart", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "company-a",
          name: "Acme",
          slug: "acme",
          status: "ACTIVE",
          defaultLanguage: "ES",
          goalsCascadeEnabled: false,
          showNineBoxOnMyResults: true,
          vacancyHiringSlaDays: 14,
          hasOfferLetterTemplate: true,
          offerLetterTemplateOriginalName: "offer.pdf",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );
    await companyApi.uploadAtsTemplate(
      "offer-letter",
      new File(["%PDF"], "offer.pdf", { type: "application/pdf" }),
    );
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/companies/current/ats-templates/offer-letter",
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
      }),
    );
  });
});
