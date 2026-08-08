import { describe, expect, it } from "vitest";
import { hiringKeys } from "@/lib/api/hiring";
import { ALLOWED_STAGE_TRANSITIONS } from "@/lib/ats/transitions";

describe("hiringKeys tenant isolation", () => {
  it("scopes by companyId", () => {
    expect(hiringKeys.byApplication("a", "app1")[1]).toBe("a");
    expect(hiringKeys.byApplication("b", "app1")[1]).toBe("b");
    expect(hiringKeys.byApplication("a", "app1")).not.toEqual(
      hiringKeys.byApplication("b", "app1"),
    );
  });
});

describe("generic transitions protect HIRED", () => {
  it("does not allow OFFER -> HIRED via Kanban move targets", () => {
    expect(ALLOWED_STAGE_TRANSITIONS.OFFER).not.toContain("HIRED");
    expect(ALLOWED_STAGE_TRANSITIONS.OFFER).toEqual([
      "REJECTED",
      "WITHDRAWN",
    ]);
  });
});
