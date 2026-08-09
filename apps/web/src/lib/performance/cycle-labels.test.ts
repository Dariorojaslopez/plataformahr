import { describe, expect, it } from "vitest";
import {
  CYCLE_STATUS_LABELS,
  cycleStatusVariant,
} from "@/lib/performance/cycle-labels";

describe("cycle labels", () => {
  it("exposes Spanish labels for all statuses", () => {
    expect(CYCLE_STATUS_LABELS.DRAFT).toBe("Borrador");
    expect(CYCLE_STATUS_LABELS.ACTIVE).toBe("Activo");
    expect(CYCLE_STATUS_LABELS.CLOSED).toBe("Cerrado");
    expect(CYCLE_STATUS_LABELS.CANCELLED).toBe("Cancelado");
  });

  it("maps status to badge variants", () => {
    expect(cycleStatusVariant("ACTIVE")).toBe("success");
    expect(cycleStatusVariant("CANCELLED")).toBe("destructive");
    expect(cycleStatusVariant("DRAFT")).toBe("secondary");
  });
});
