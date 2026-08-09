import type {
  GoalCycleStatus,
  GoalMetricDirection,
  GoalMetricType,
  GoalStatus,
  GoalType,
} from "@/types/goals";

export const GOAL_CYCLE_STATUS_LABELS: Record<GoalCycleStatus, string> = {
  DRAFT: "Borrador",
  ACTIVE: "Activo",
  CLOSED: "Cerrado",
  CANCELLED: "Cancelado",
};

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  DRAFT: "Borrador",
  ACTIVE: "Activo",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  INDIVIDUAL: "Individual",
  AREA: "Área",
  COMPANY: "Compañía",
};

export const METRIC_TYPE_LABELS: Record<GoalMetricType, string> = {
  NUMBER: "Número",
  PERCENTAGE: "Porcentaje",
  CURRENCY: "Moneda",
  BOOLEAN: "Sí/No",
};

export const DIRECTION_LABELS: Record<GoalMetricDirection, string> = {
  INCREASE: "Aumentar",
  DECREASE: "Reducir",
};

export function cycleStatusVariant(
  status: GoalCycleStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ACTIVE") return "default";
  if (status === "CANCELLED") return "destructive";
  if (status === "CLOSED") return "secondary";
  return "outline";
}

export function goalStatusVariant(
  status: GoalStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ACTIVE") return "default";
  if (status === "CANCELLED") return "destructive";
  if (status === "COMPLETED") return "secondary";
  return "outline";
}

export function formatKeyResultTarget(kr: {
  metricType: GoalMetricType;
  targetValue: string | null;
  targetBoolean: boolean | null;
  unit: string | null;
  currencyCode: string | null;
}): string {
  if (kr.metricType === "BOOLEAN") {
    return kr.targetBoolean ? "Cumplir" : "No cumplir";
  }
  const value = kr.targetValue ?? "—";
  if (kr.metricType === "PERCENTAGE") return `${value} %`;
  if (kr.metricType === "CURRENCY") {
    return `${kr.currencyCode ?? ""} ${value}`.trim();
  }
  return kr.unit ? `${value} ${kr.unit}` : value;
}
