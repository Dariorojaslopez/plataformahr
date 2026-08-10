import type {
  CycleParticipantListItem,
  PerformanceCycleStatus,
  PerformanceResultStatus,
} from "@/types/performance";

export const RESULT_STATUS_LABELS: Record<PerformanceResultStatus, string> = {
  CALCULATED: "Calculado",
  RELEASED: "Publicado",
};

export function resultStatusVariant(
  status: PerformanceResultStatus,
): "secondary" | "success" {
  return status === "RELEASED" ? "success" : "secondary";
}

export const RELEASE_RESULT_CONFIRMATION =
  "Al publicar, el colaborador verá el resultado consolidado (puntaje overall y su autoevaluación). Los comentarios del líder no se publican.";

/** All existing evaluations must be SUBMITTED; missing type is OK (re-normalize). */
export function canCalculateParticipantResult(params: {
  cycleStatus: PerformanceCycleStatus;
  participant: Pick<
    CycleParticipantListItem,
    "status" | "evaluations" | "result"
  >;
}): boolean {
  if (params.cycleStatus !== "ACTIVE") return false;
  if (params.participant.status !== "ACTIVE") return false;
  if (params.participant.result) return false;

  const { self, manager } = params.participant.evaluations;
  const existing = [self, manager].filter(
    (e): e is NonNullable<typeof e> => e != null,
  );
  if (existing.length === 0) return false;
  return existing.every((e) => e.status === "SUBMITTED");
}

export function canReleaseParticipantResult(
  participant: Pick<CycleParticipantListItem, "result">,
  cycleStatus?: PerformanceCycleStatus,
): boolean {
  if (participant.result?.status !== "CALCULATED") return false;
  // Backend allows release on ACTIVE or CLOSED (not CANCELLED/DRAFT).
  if (cycleStatus != null && cycleStatus !== "ACTIVE" && cycleStatus !== "CLOSED") {
    return false;
  }
  return true;
}

/** Result mutations (calculate/release) allowed while cycle is ACTIVE or CLOSED. */
export function canMutateParticipantResults(
  cycleStatus: PerformanceCycleStatus,
): boolean {
  return cycleStatus === "ACTIVE" || cycleStatus === "CLOSED";
}

export function managerIncludedLabel(managerIncluded: boolean): string {
  return managerIncluded
    ? "Incluye evaluación de líder"
    : "Solo autoevaluación (sin evaluación de líder en el consolidado)";
}
