import type {
  GoalProgressStatus,
  PdiDerivedStatus,
} from "@/types/performance";

export const GOAL_PROGRESS_STATUS_LABELS: Record<GoalProgressStatus, string> = {
  NOT_STARTED: "No iniciado",
  IN_PROGRESS: "En proceso",
  FINISHED: "Finalizado",
};

export const PDI_STATUS_LABELS: Record<PdiDerivedStatus, string> = {
  NOT_STARTED: "No iniciado",
  IN_PROGRESS: "En proceso",
  COMPLETED: "Completado",
};

export const SCALE_KIND_LABELS = {
  QUALITATIVE: "Cualitativa",
  QUANTITATIVE: "Cuantitativa",
} as const;

export function clampProgressPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function pdiStatusFromPercent(percent: number): PdiDerivedStatus {
  const value = clampProgressPercent(percent);
  if (value <= 0) return "NOT_STARTED";
  if (value >= 100) return "COMPLETED";
  return "IN_PROGRESS";
}

export function progressStatusFromPercent(percent: number): GoalProgressStatus {
  const status = pdiStatusFromPercent(percent);
  if (status === "COMPLETED") return "FINISHED";
  return status;
}
