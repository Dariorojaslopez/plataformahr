import { GoalMetricDirection, GoalMetricType } from '@prisma/client';
import {
  calculateGoalProgress,
  calculateKeyResultProgress,
  roundProgress,
} from './goal-progress';

export type KeyResultAchievementInput = {
  metricType: GoalMetricType;
  direction: GoalMetricDirection | null;
  startValue: number | null;
  targetValue: number | null;
  /** Required at approval time — every KR must have a check-in. */
  finalNumericValue: number | null;
  finalBooleanValue: boolean | null;
};

export type GoalAchievementKrInput = {
  achievementPercentage: number;
  configuredWeight: number | null;
};

export type EffectiveWeightRow = {
  configuredWeight: number | null;
  effectiveWeight: number;
};

/** Round formal achievement to 2 decimals. */
export function roundAchievement(value: number): number {
  return roundProgress(value);
}

/**
 * Formal KR achievement at completion (0–100).
 * Same mathematical base as 09B progress, but named separately so semantics can diverge later.
 * Requires an explicit final value (from latest check-in at approval).
 */
export function calculateKeyResultAchievement(
  input: KeyResultAchievementInput,
): number {
  return calculateKeyResultProgress({
    metricType: input.metricType,
    direction: input.direction,
    startValue: input.startValue,
    targetValue: input.targetValue,
    currentNumericValue: input.finalNumericValue,
    currentBooleanValue: input.finalBooleanValue,
    hasCheckIn: true,
  });
}

/**
 * Aggregate Goal achievement from KR achievements.
 * Weighted: sum(achievement * weight) / sum(weights).
 * Unweighted: simple average.
 */
export function calculateGoalAchievement(
  keyResults: GoalAchievementKrInput[],
): number {
  return calculateGoalProgress(
    keyResults.map((kr) => ({
      progressPercentage: kr.achievementPercentage,
      weight: kr.configuredWeight,
    })),
  );
}

/**
 * Effective weights for snapshot:
 * - weighted: effectiveWeight = configuredWeight
 * - unweighted: equal shares summing to 100 (last adjusted for rounding).
 */
export function computeEffectiveWeights(
  configuredWeights: Array<number | null>,
): EffectiveWeightRow[] {
  if (configuredWeights.length === 0) return [];

  const anyWeighted = configuredWeights.some((w) => w != null);
  if (anyWeighted) {
    return configuredWeights.map((w) => ({
      configuredWeight: w,
      effectiveWeight: roundAchievement(w ?? 0),
    }));
  }

  const n = configuredWeights.length;
  const base = roundAchievement(100 / n);
  const rows: EffectiveWeightRow[] = [];
  let allocated = 0;
  for (let i = 0; i < n; i += 1) {
    if (i === n - 1) {
      rows.push({
        configuredWeight: null,
        effectiveWeight: roundAchievement(100 - allocated),
      });
    } else {
      rows.push({ configuredWeight: null, effectiveWeight: base });
      allocated = roundAchievement(allocated + base);
    }
  }
  return rows;
}
