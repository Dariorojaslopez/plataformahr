import type { PerformanceCycleStatus } from "@/types/performance";

export const CYCLE_STATUS_LABELS: Record<PerformanceCycleStatus, string> = {
  DRAFT: "Borrador",
  ACTIVE: "Activo",
  CLOSED: "Cerrado",
  CANCELLED: "Cancelado",
};

export function cycleStatusVariant(
  status: PerformanceCycleStatus,
): "secondary" | "success" | "outline" | "destructive" {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "CLOSED":
      return "outline";
    case "CANCELLED":
      return "destructive";
    default:
      return "secondary";
  }
}
