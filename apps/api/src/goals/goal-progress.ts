import { GoalMetricDirection, GoalMetricType } from '@prisma/client';

export type KeyResultProgressInput = {
  metricType: GoalMetricType;
  direction: GoalMetricDirection | null;
  /** Null start treated as 0 for numeric progress (operational). */
  startValue: number | null;
  targetValue: number | null;
  /** Current numeric from latest check-in, or null → use start. */
  currentNumericValue: number | null;
  /** Current boolean from latest check-in, or null → false (0%). */
  currentBooleanValue: boolean | null;
  hasCheckIn: boolean;
};

export type GoalProgressKrInput = {
  progressPercentage: number;
  weight: number | null;
};

/** Round to 2 decimal places for operational progress display. */
export function roundProgress(value: number): number {
  return Number(value.toFixed(2));
}

function clamp01to100(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

/**
 * Operational KR progress (0–100). Not a performance score.
 * BOOLEAN: no check-in / false → 0; true → 100.
 * Numeric INCREASE: (current - start) / (target - start) * 100
 * Numeric DECREASE: (start - current) / (start - target) * 100
 * start == target: fulfilled → 100 else 0 (direction-aware equality).
 */
export function calculateKeyResultProgress(
  input: KeyResultProgressInput,
): number {
  if (input.metricType === GoalMetricType.BOOLEAN) {
    if (!input.hasCheckIn || input.currentBooleanValue !== true) {
      return 0;
    }
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

  const direction = input.direction;
  let raw: number;
  if (direction === GoalMetricDirection.DECREASE) {
    raw = ((start - current) / (start - target)) * 100;
  } else {
    // INCREASE (required for numeric KRs in 09A); defensive default INCREASE.
    raw = ((current - start) / (target - start)) * 100;
  }

  return roundProgress(clamp01to100(raw));
}

/**
 * Aggregate Goal progress from KR progress.
 * All weights null → simple average.
 * Any weight → weighted average (09A activation guarantees all set + sum 100).
 */
export function calculateGoalProgress(
  keyResults: GoalProgressKrInput[],
): number {
  if (keyResults.length === 0) return 0;

  const weights = keyResults.map((kr) => kr.weight);
  const anyWeighted = weights.some((w) => w != null);

  if (!anyWeighted) {
    const sum = keyResults.reduce((acc, kr) => acc + kr.progressPercentage, 0);
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
