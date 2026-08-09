import type { GoalMetricDirection, GoalMetricType } from "@/types/goals";

export type KeyResultProgressInput = {
  metricType: GoalMetricType;
  direction: GoalMetricDirection | null;
  startValue: number | null;
  targetValue: number | null;
  currentNumericValue: number | null;
  currentBooleanValue: boolean | null;
  hasCheckIn: boolean;
};

export function roundProgress(value: number): number {
  return Number(value.toFixed(2));
}

function clamp01to100(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

/** Operational KR progress (mirrors API helper). Not a score. */
export function calculateKeyResultProgress(
  input: KeyResultProgressInput,
): number {
  if (input.metricType === "BOOLEAN") {
    if (!input.hasCheckIn || input.currentBooleanValue !== true) return 0;
    return 100;
  }

  const start = input.startValue ?? 0;
  const target = input.targetValue;
  if (target == null) return 0;

  const current =
    input.hasCheckIn && input.currentNumericValue != null
      ? input.currentNumericValue
      : start;

  if (start === target) {
    return current === target ? 100 : 0;
  }

  const raw =
    input.direction === "DECREASE"
      ? ((start - current) / (start - target)) * 100
      : ((current - start) / (target - start)) * 100;

  return roundProgress(clamp01to100(raw));
}

export function calculateGoalProgress(
  keyResults: Array<{ progressPercentage: number; weight: number | null }>,
): number {
  if (keyResults.length === 0) return 0;
  const anyWeighted = keyResults.some((kr) => kr.weight != null);
  if (!anyWeighted) {
    const sum = keyResults.reduce((a, kr) => a + kr.progressPercentage, 0);
    return roundProgress(sum / keyResults.length);
  }
  let weightedSum = 0;
  let weightTotal = 0;
  for (const kr of keyResults) {
    const w = kr.weight ?? 0;
    weightedSum += kr.progressPercentage * w;
    weightTotal += w;
  }
  if (weightTotal <= 0) return 0;
  return roundProgress(weightedSum / weightTotal);
}

export function formatProgressPercent(value: number): string {
  return `${roundProgress(value)} %`;
}

/** Build create-check-in body from form state (no metricType). */
export function buildCheckInPayload(params: {
  metricType: GoalMetricType;
  numericText: string;
  booleanValue: boolean | null;
  comment: string;
  evidenceReference: string;
}): {
  numericValue?: number;
  booleanValue?: boolean;
  comment?: string | null;
  evidenceReference?: string | null;
} {
  const comment = params.comment.trim() || null;
  const evidenceReference = params.evidenceReference.trim() || null;

  if (params.metricType === "BOOLEAN") {
    if (params.booleanValue == null) {
      throw new Error("Selecciona Sí o No");
    }
    return {
      booleanValue: params.booleanValue,
      comment,
      evidenceReference,
    };
  }

  const normalized = params.numericText.trim().replace(",", ".");
  if (!normalized || Number.isNaN(Number(normalized))) {
    throw new Error("Ingresa un valor numérico válido");
  }
  // Reject thousand separators: only plain decimal
  if (/[^\d.\-]/.test(normalized) || (normalized.match(/\./g) ?? []).length > 1) {
    throw new Error("Usa un número sin separadores de miles");
  }

  return {
    numericValue: Number(normalized),
    comment,
    evidenceReference,
  };
}

export function formatCurrentValue(params: {
  metricType: GoalMetricType;
  currentNumericValue: string | null;
  currentBooleanValue: boolean | null;
  currencyCode?: string | null;
  unit?: string | null;
}): string {
  if (params.metricType === "BOOLEAN") {
    return params.currentBooleanValue ? "Completado" : "No completado";
  }
  const n = params.currentNumericValue ?? "0";
  if (params.metricType === "CURRENCY" && params.currencyCode) {
    return `${params.currencyCode} ${n}`;
  }
  if (params.unit) return `${n} ${params.unit}`;
  if (params.metricType === "PERCENTAGE") return `${n} %`;
  return n;
}
