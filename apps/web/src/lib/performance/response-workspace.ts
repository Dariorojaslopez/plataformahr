import type {
  EvaluationSnapshotCompetency,
  PerformanceEvaluationDetail,
  PerformanceEvaluationStatus,
} from "@/types/performance";

export const EVALUATION_COMMENT_MAX_LENGTH = 2000;

/** True when the current actor may edit responses (backend-authoritative flag). */
export function hasEvaluationResponseControls(
  evaluation?: Pick<PerformanceEvaluationDetail, "editable"> | null,
): boolean {
  return evaluation?.editable === true;
}

export function isEvaluationSubmitted(
  status: PerformanceEvaluationStatus,
): boolean {
  return status === "SUBMITTED";
}

export type MineEvaluationCta = {
  label: string;
  intent: "start" | "continue" | "view";
};

export function mineEvaluationCta(
  status: PerformanceEvaluationStatus,
): MineEvaluationCta {
  if (status === "PENDING") return { label: "Comenzar", intent: "start" };
  if (status === "IN_PROGRESS") {
    return { label: "Continuar", intent: "continue" };
  }
  return { label: "Ver resultado", intent: "view" };
}

export function formatScorePercentage(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `${n.toFixed(2)}%`;
}

export function evaluationProgress(params: {
  respondedCount: number;
  competencyCount: number;
}): { label: string; percent: number } {
  const total = Math.max(0, params.competencyCount);
  const done = Math.max(0, Math.min(params.respondedCount, total));
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return {
    label: `${done} de ${total} competencias respondidas`,
    percent,
  };
}

export function requiredMissingCompetencies(
  competencies: EvaluationSnapshotCompetency[],
): EvaluationSnapshotCompetency[] {
  return competencies.filter((c) => c.required && !c.response);
}

export function isCompetencyDirty(params: {
  selectedScaleLevelId: string | null;
  comment: string;
  saved: EvaluationSnapshotCompetency["response"];
}): boolean {
  const savedLevel = params.saved?.selectedScaleLevelId ?? null;
  const savedComment = params.saved?.comment ?? "";
  const localComment = params.comment.trim();
  return (
    params.selectedScaleLevelId !== savedLevel ||
    localComment !== savedComment
  );
}

export function buildSaveResponsePayload(params: {
  scaleLevelId: string;
  comment: string;
}): { scaleLevelId: string; comment: string | null } {
  const trimmed = params.comment.trim();
  return {
    scaleLevelId: params.scaleLevelId,
    comment: trimmed.length === 0 ? null : trimmed,
  };
}
