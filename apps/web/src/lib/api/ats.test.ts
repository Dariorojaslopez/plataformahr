import { beforeEach, describe, expect, it, vi } from "vitest";
import { atsApi, atsKeys } from "@/lib/api/ats";

vi.mock("@/lib/api/client", () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from "@/lib/api/client";

const mockedRequest = vi.mocked(apiRequest);

describe("atsApi", () => {
  beforeEach(() => {
    mockedRequest.mockReset();
    mockedRequest.mockResolvedValue({} as never);
  });

  it("lists vacancy requests with filters", async () => {
    await atsApi.listVacancyRequests({
      status: "DRAFT",
      type: "EXISTING_POSITION",
      search: "dev",
      page: 2,
    });
    expect(mockedRequest).toHaveBeenCalledWith(
      "/ats/vacancy-requests?status=DRAFT&type=EXISTING_POSITION&search=dev&page=2",
    );
  });

  it("submits and decides vacancy requests", async () => {
    await atsApi.submitVacancyRequest("vr-1");
    await atsApi.approveVacancyRequest("vr-1", { comment: "ok" });
    await atsApi.rejectVacancyRequest("vr-1", { comment: "no" });
    expect(mockedRequest).toHaveBeenNthCalledWith(
      1,
      "/ats/vacancy-requests/vr-1/submit",
      { method: "POST" },
    );
    expect(mockedRequest).toHaveBeenNthCalledWith(
      2,
      "/ats/vacancy-requests/vr-1/approve",
      { method: "POST", body: { comment: "ok" } },
    );
    expect(mockedRequest).toHaveBeenNthCalledWith(
      3,
      "/ats/vacancy-requests/vr-1/reject",
      { method: "POST", body: { comment: "no" } },
    );
  });

  it("lists vacancies and patches status", async () => {
    await atsApi.listVacancies({ status: "OPEN", search: "eng" });
    await atsApi.updateVacancy("v1", { status: "PAUSED" });
    expect(mockedRequest).toHaveBeenCalledWith(
      "/ats/vacancies?status=OPEN&search=eng",
    );
    expect(mockedRequest).toHaveBeenCalledWith("/ats/vacancies/v1", {
      method: "PATCH",
      body: { status: "PAUSED" },
    });
  });

  it("creates candidate and application", async () => {
    await atsApi.createCandidate({
      firstName: "Ana",
      lastName: "Ruiz",
      email: "ana@example.com",
    });
    await atsApi.createApplicationForCandidate("c1", { vacancyId: "v1" });
    expect(mockedRequest).toHaveBeenCalledWith("/ats/candidates", {
      method: "POST",
      body: {
        firstName: "Ana",
        lastName: "Ruiz",
        email: "ana@example.com",
      },
    });
    expect(mockedRequest).toHaveBeenCalledWith(
      "/ats/candidates/c1/applications",
      { method: "POST", body: { vacancyId: "v1" } },
    );
  });

  it("moves application and loads history/pipeline", async () => {
    await atsApi.moveApplication("a1", { stage: "CONTACTED" });
    await atsApi.getApplicationHistory("a1");
    await atsApi.getVacancyPipeline("v1");
    expect(mockedRequest).toHaveBeenCalledWith("/ats/applications/a1/move", {
      method: "POST",
      body: { stage: "CONTACTED" },
    });
    expect(mockedRequest).toHaveBeenCalledWith("/ats/applications/a1/history");
    expect(mockedRequest).toHaveBeenCalledWith("/ats/vacancies/v1/pipeline");
  });
});

describe("atsKeys tenant isolation", () => {
  it("includes companyId in all keys", () => {
    expect(atsKeys.candidates("company-a", { page: 1 })[1]).toBe("company-a");
    expect(atsKeys.candidates("company-b", { page: 1 })[1]).toBe("company-b");
    expect(atsKeys.pipeline("c1", "v1")).toEqual(["ats", "c1", "pipeline", "v1"]);
    expect(atsKeys.vacancyRequests("c1", { status: "DRAFT" })[1]).toBe("c1");
  });

  it("does not reuse keys across tenants", () => {
    const a = atsKeys.vacancies("a", { status: "OPEN" });
    const b = atsKeys.vacancies("b", { status: "OPEN" });
    expect(a).not.toEqual(b);
  });
});
