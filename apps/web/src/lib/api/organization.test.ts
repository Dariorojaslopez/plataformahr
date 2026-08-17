import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { organizationApi } from "@/lib/api/organization";

describe("organizationApi", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists employees with query filters and pagination", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [],
          page: 2,
          limit: 20,
          total: 0,
          totalPages: 1,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await organizationApi.listEmployees({
      search: "ana",
      status: "ACTIVE",
      areaId: "area-1",
      page: 2,
      limit: 20,
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/organization/employees?"),
      expect.any(Object),
    );
    const url = String(vi.mocked(fetch).mock.calls[0]?.[0]);
    expect(url).toContain("search=ana");
    expect(url).toContain("status=ACTIVE");
    expect(url).toContain("areaId=area-1");
    expect(url).toContain("page=2");
  });

  it("creates employee via POST", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "e1",
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@example.com",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );

    await organizationApi.createEmployee({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      areaId: "a1",
      positionId: "p1",
    });

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/organization/employees",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("loads area tree endpoint", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await organizationApi.getAreaTree();
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/organization/areas/tree",
      expect.any(Object),
    );
  });

  it("creates and deletes reporting lines", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "rl1" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    await organizationApi.createReportingLine("emp-1", {
      managerEmployeeId: "mgr-1",
      type: "DIRECT",
    });
    await organizationApi.deleteReportingLine("emp-1", "rl-1");

    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toContain(
      "/organization/employees/emp-1/reporting-lines",
    );
    expect(vi.mocked(fetch).mock.calls[1]?.[1]).toMatchObject({
      method: "DELETE",
    });
  });

  it("loads and replaces job level competencies", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jobLevelId: "jl1",
            assigned: [],
            catalog: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jobLevelId: "jl1",
            assigned: [{ id: "c1", name: "Liderazgo", code: null, status: "ACTIVE" }],
            catalog: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    await organizationApi.getJobLevelCompetencies("jl1");
    await organizationApi.replaceJobLevelCompetencies("jl1", {
      competencyIds: ["c1"],
    });

    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toContain(
      "/organization/job-levels/jl1/competencies",
    );
    expect(vi.mocked(fetch).mock.calls[1]?.[1]).toMatchObject({
      method: "PUT",
    });
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1]?.[1]?.body))).toEqual(
      { competencyIds: ["c1"] },
    );
  });

  it("manages position custom field definitions", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "f1", key: "codigo_sap", type: "TEXT" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "f1", active: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    await organizationApi.listPositionCustomFields();
    await organizationApi.createPositionCustomField({
      key: "codigo_sap",
      label: "Código SAP",
      type: "TEXT",
    });
    await organizationApi.updatePositionCustomField("f1", { active: false });

    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toContain(
      "/organization/position-custom-fields",
    );
    expect(vi.mocked(fetch).mock.calls[1]?.[1]).toMatchObject({ method: "POST" });
    expect(vi.mocked(fetch).mock.calls[2]?.[1]).toMatchObject({ method: "PATCH" });
  });

  it("loads the organization chart", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ roots: [], employeeCount: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await organizationApi.getOrgChart(true);
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain(
      "/organization/org-chart?includeInactive=true",
    );
  });
});
