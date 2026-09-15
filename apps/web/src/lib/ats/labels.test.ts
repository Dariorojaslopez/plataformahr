import { describe, expect, it } from "vitest";
import { vacancyRequestStatusPresentation } from "@/lib/ats/labels";

describe("vacancyRequestStatusPresentation", () => {
  it("labels a returned draft as Devuelta", () => {
    expect(
      vacancyRequestStatusPresentation({
        status: "DRAFT",
        returnedAt: "2026-09-14T12:00:00.000Z",
      }),
    ).toEqual({ label: "Devuelta", variant: "warning" });
  });

  it("keeps a new draft as Borrador", () => {
    expect(
      vacancyRequestStatusPresentation({
        status: "DRAFT",
        returnedAt: null,
      }),
    ).toEqual({ label: "Borrador", variant: "secondary" });
  });
});
