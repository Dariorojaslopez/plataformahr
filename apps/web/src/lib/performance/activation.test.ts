import { describe, expect, it } from "vitest";
import {
  canActivateCycle,
  canCancelCycle,
  canCloseCycle,
  canEditCycleMetadata,
  canEditCycleStructure,
} from "@/lib/performance/activation";

describe("cycle activation helpers", () => {
  it("allows structural and metadata edits only in DRAFT", () => {
    expect(canEditCycleStructure("DRAFT")).toBe(true);
    expect(canEditCycleStructure("ACTIVE")).toBe(false);
    expect(canEditCycleMetadata("DRAFT")).toBe(true);
    expect(canEditCycleMetadata("CLOSED")).toBe(false);
  });

  it("requires DRAFT, competencies and valid weights to activate", () => {
    expect(
      canActivateCycle({
        status: "DRAFT",
        competencyCount: 2,
        weights: [null, null],
      }),
    ).toBe(true);

    expect(
      canActivateCycle({
        status: "DRAFT",
        competencyCount: 0,
        weights: [],
      }),
    ).toBe(false);

    expect(
      canActivateCycle({
        status: "DRAFT",
        competencyCount: 0,
        weights: [],
        includeCompetencies: false,
      }),
    ).toBe(true);

    expect(
      canActivateCycle({
        status: "ACTIVE",
        competencyCount: 2,
        weights: [null, null],
      }),
    ).toBe(false);

    expect(
      canActivateCycle({
        status: "DRAFT",
        competencyCount: 2,
        weights: [50, null],
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
