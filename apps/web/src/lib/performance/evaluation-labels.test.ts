import { describe, expect, it } from "vitest";
import {
  EVALUATION_STATUS_LABELS,
  EVALUATION_TYPE_LABELS,
  evaluationStatusVariant,
} from "@/lib/performance/evaluation-labels";

describe("evaluation labels", () => {
  it("exposes Spanish labels for types and statuses", () => {
    expect(EVALUATION_TYPE_LABELS.SELF).toBe("Autoevaluación");
    expect(EVALUATION_TYPE_LABELS.MANAGER).toBe("Evaluación de líder");
    expect(EVALUATION_STATUS_LABELS.PENDING).toBe("Pendiente");
    expect(EVALUATION_STATUS_LABELS.IN_PROGRESS).toBe("En progreso");
    expect(EVALUATION_STATUS_LABELS.SUBMITTED).toBe("Enviada");
  });

  it("maps status to badge variants", () => {
    expect(evaluationStatusVariant("PENDING")).toBe("secondary");
    expect(evaluationStatusVariant("IN_PROGRESS")).toBe("default");
    expect(evaluationStatusVariant("SUBMITTED")).toBe("success");
  });
});
