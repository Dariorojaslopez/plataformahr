import { describe, expect, it } from "vitest";
import { atsKeys } from "@/lib/api/ats";

describe("ats query keys tenant isolation", () => {
  it("scopes list and detail keys by companyId", () => {
    const a = atsKeys.candidates("company-a", { page: 1 });
    const b = atsKeys.candidates("company-b", { page: 1 });
    expect(a[1]).toBe("company-a");
    expect(b[1]).toBe("company-b");
    expect(a).not.toEqual(b);

    expect(atsKeys.pipeline("c1", "v1")[1]).toBe("c1");
    expect(atsKeys.vacancy("c1", "v1")[1]).toBe("c1");
    expect(atsKeys.application("c1", "a1")[1]).toBe("c1");
  });

  it("keeps company boundaries between org-like ATS collections", () => {
    expect(atsKeys.all("a")).not.toEqual(atsKeys.all("b"));
    expect(atsKeys.vacancies("a", {})[1]).toBe("a");
    expect(atsKeys.vacancyRequests("b", {})[1]).toBe("b");
  });
});
