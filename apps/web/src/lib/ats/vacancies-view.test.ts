import { describe, expect, it } from "vitest";
import { recruiterSeesAssignedOnly } from "@/lib/ats/vacancies-view";

describe("vacancies view", () => {
  it("scopes the vacancy list to assigned processes for recruiters", () => {
    expect(recruiterSeesAssignedOnly(["RECRUITER"])).toBe(true);
    expect(recruiterSeesAssignedOnly(["RECRUITER", "LEADER"])).toBe(true);
    expect(recruiterSeesAssignedOnly(["CLIENT_ADMIN", "RECRUITER"])).toBe(
      false,
    );
    expect(recruiterSeesAssignedOnly(["CLIENT_ADMIN"])).toBe(false);
    expect(recruiterSeesAssignedOnly(["ADMINISTRATOR"])).toBe(false);
    expect(recruiterSeesAssignedOnly(["RECRUITMENT_LEADER"])).toBe(false);
    expect(
      recruiterSeesAssignedOnly(["RECRUITER", "RECRUITMENT_LEADER"]),
    ).toBe(false);
  });
});
