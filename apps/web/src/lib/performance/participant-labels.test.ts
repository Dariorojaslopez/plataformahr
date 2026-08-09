import { describe, expect, it } from "vitest";
import {
  PARTICIPANT_STATUS_LABELS,
  participantStatusVariant,
} from "@/lib/performance/participant-labels";

describe("participant labels", () => {
  it("exposes Spanish labels for all statuses", () => {
    expect(PARTICIPANT_STATUS_LABELS.ACTIVE).toBe("Activo");
    expect(PARTICIPANT_STATUS_LABELS.COMPLETED).toBe("Completado");
    expect(PARTICIPANT_STATUS_LABELS.EXCLUDED).toBe("Excluido");
  });

  it("maps status to badge variants", () => {
    expect(participantStatusVariant("ACTIVE")).toBe("success");
    expect(participantStatusVariant("COMPLETED")).toBe("outline");
    expect(participantStatusVariant("EXCLUDED")).toBe("destructive");
  });
});
