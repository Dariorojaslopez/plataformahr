import type { GoalCompletionRequestStatus } from "@/types/goals";

export const COMPLETION_STATUS_LABELS: Record<
  GoalCompletionRequestStatus,
  string
> = {
  PENDING: "En revisión de cierre",
  APPROVED: "Cierre aprobado",
  REJECTED: "Cierre rechazado",
};

export function formatAchievementPercent(
  value: string | number | null | undefined,
): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  return `${n.toFixed(2)} %`;
}

export function buildRequestCompletionPayload(comment: string): {
  requestComment: string | null;
} {
  const trimmed = comment.trim();
  return { requestComment: trimmed.length ? trimmed : null };
}

export function buildApprovePayload(comment: string): {
  reviewComment: string | null;
} {
  const trimmed = comment.trim();
  return { reviewComment: trimmed.length ? trimmed : null };
}

export function buildRejectPayload(comment: string): { reviewComment: string } {
  const trimmed = comment.trim();
  if (!trimmed) throw new Error("El comentario de rechazo es obligatorio");
  return { reviewComment: trimmed };
}

/** UI copy guards — never call operational progress a final score. */
export function estimatedAchievementLabel(): string {
  return "Cumplimiento estimado";
}

export function finalAchievementLabel(): string {
  return "Cumplimiento final";
}
