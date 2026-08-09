import type {
  PerformanceEvaluationStatus,
  PerformanceEvaluationType,
} from "@/types/performance";

export const EVALUATION_TYPE_LABELS: Record<
  PerformanceEvaluationType,
  string
> = {
  SELF: "Autoevaluación",
  MANAGER: "Evaluación de líder",
};

export const EVALUATION_STATUS_LABELS: Record<
  PerformanceEvaluationStatus,
  string
> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En progreso",
  SUBMITTED: "Enviada",
};

export function evaluationStatusVariant(
  status: PerformanceEvaluationStatus,
): "secondary" | "default" | "success" {
  switch (status) {
    case "SUBMITTED":
      return "success";
    case "IN_PROGRESS":
      return "default";
    default:
      return "secondary";
  }
}
