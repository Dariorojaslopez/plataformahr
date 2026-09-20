import { describe, expect, it } from "vitest";
import {
  canActivateCycle,
  canCancelCycle,
  canCloseCycle,
  canEditCycleMetadata,
  canEditCycleStructure,
} from "@/lib/performance/activation";

describe("cycle activation helpers", () => {
  it("allows metadata edits in DRAFT and ACTIVE, structure only in DRAFT", () => {
    expect(canEditCycleStructure("DRAFT")).toBe(true);
    expect(canEditCycleStructure("ACTIVE")).toBe(false);
    expect(canEditCycleMetadata("DRAFT")).toBe(true);
    expect(canEditCycleMetadata("ACTIVE")).toBe(true);
    expect(canEditCycleMetadata("CLOSED")).toBe(false);
  });

  it("requires DRAFT and competencies to activate", () => {
    expect(
      canActivateCycle({
        status: "DRAFT",
        competencyCount: 2,
      }),
    ).toBe(true);

    expect(
      canActivateCycle({
        status: "DRAFT",
        competencyCount: 0,
      }),
    ).toBe(false);

    expect(
      canActivateCycle({
        status: "DRAFT",
        competencyCount: 0,
        includeCompetencies: false,
      }),
    ).toBe(true);

    expect(
      canActivateCycle({
        status: "ACTIVE",
        competencyCount: 2,
      }),
    ).toBe(false);
  });

  it("gates close and cancel by status", () => {
    expect(canCloseCycle("ACTIVE")).toBe(true);
    expect(canCloseCycle("DRAFT")).toBe(false);
    expect(canCancelCycle("DRAFT")).toBe(true);
    expect(canCancelCycle("ACTIVE")).toBe(true);
    expect(canCancelCycle("CLOSED")).toBe(false);
  });
});
