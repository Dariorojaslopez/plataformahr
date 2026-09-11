import { describe, expect, it } from "vitest";
import {
  approvedActiveProcessesForRecruiterAssignment,
  recruiterSeesAssignedOnly,
} from "@/lib/ats/vacancies-view";

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

  it("keeps approved active processes that already have a vacancy", () => {
    expect(
      approvedActiveProcessesForRecruiterAssignment([
        {
          status: "PENDING_APPROVAL",
          title: "En trámite",
          vacancyId: null,
          vacancyStatus: null,
        },
        {
          status: "APPROVED",
          title: "Cerrada",
          vacancyId: "vac-closed",
          vacancyStatus: "CLOSED",
        },
        {
          status: "APPROVED",
          title: "Analista",
          vacancyId: "vac-open",
          vacancyStatus: "OPEN",
        },
        {
          status: "APPROVED",
          title: "Pausada",
          vacancyId: "vac-paused",
          vacancyStatus: "PAUSED",
        },
      ]).map((item) => item.vacancyId),
    ).toEqual(["vac-open", "vac-paused"]);
  });
});
