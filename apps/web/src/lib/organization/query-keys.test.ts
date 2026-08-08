import { describe, expect, it } from "vitest";
import { orgKeys } from "@/lib/api/organization";

describe("org query keys tenant isolation", () => {
  it("includes companyId in every organization key", () => {
    const a = orgKeys.employees("company-a", { page: 1 });
    const b = orgKeys.employees("company-b", { page: 1 });
    expect(a[1]).toBe("company-a");
    expect(b[1]).toBe("company-b");
    expect(a).not.toEqual(b);
  });

  it("scopes profile and reporting keys by company", () => {
    expect(orgKeys.employeeProfile("c1", "e1")[1]).toBe("c1");
    expect(orgKeys.reportingLines("c1", "e1")[1]).toBe("c1");
    expect(orgKeys.areaTree("c1")[1]).toBe("c1");
  });
});
