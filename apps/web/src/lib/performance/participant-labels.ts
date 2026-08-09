import type { PerformanceParticipantStatus } from "@/types/performance";

export const PARTICIPANT_STATUS_LABELS: Record<
  PerformanceParticipantStatus,
  string
> = {
  ACTIVE: "Activo",
  COMPLETED: "Completado",
  EXCLUDED: "Excluido",
};

export function participantStatusVariant(
  status: PerformanceParticipantStatus,
): "success" | "outline" | "destructive" {
  switch (status) {
    case "COMPLETED":
      return "outline";
    case "EXCLUDED":
      return "destructive";
    default:
      return "success";
  }
}
