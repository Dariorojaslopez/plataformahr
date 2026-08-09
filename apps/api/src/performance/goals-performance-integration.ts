import { roundScorePercentage } from './evaluation-score';
import { computeEffectiveWeights } from '../goals/goal-achievement';

export type ApplicableGoalResultInput = {
  sourceGoalId: string;
  sourceGoalResultId: string;
  goalTitle: string;
  goalType: 'INDIVIDUAL' | 'AREA' | 'COMPANY';
  achievementPercentage: number;
  /** Goal.weight snapshot at GoalResult (goalConfiguredWeight). */
  configuredWeight: number | null;
};

export type GoalsAggregationResult = {
  goalsAchievement: number;
  snapshots: Array<{
    sourceGoalId: string;
    sourceGoalResultId: string;
    goalTitle: string;
    goalType: 'INDIVIDUAL' | 'AREA' | 'COMPANY';
    achievementPercentage: number;
    configuredWeight: number | null;
    effectiveWeight: number;
    contribution: number;
    order: number;
  }>;
};

export type IntegratedOverallInput = {
  competencyScore: number;
  goalsAchievement: number;
  competencyResultWeight: number;
  goalsResultWeight: number;
};

export class GoalsPerformanceIntegrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoalsPerformanceIntegrationError';
  }
}

function toNum(
  value: number | string | null | undefined,
  field: string,
): number {
  if (value == null) {
    throw new GoalsPerformanceIntegrationError(`${field} is required`);
  }
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) {
    throw new GoalsPerformanceIntegrationError(`Invalid ${field}`);
  }
  return n;
}

export function assertCompositionWeights(
  competencyResultWeight: number,
  goalsResultWeight: number,
): void {
  if (
    competencyResultWeight < 0 ||
    competencyResultWeight > 100 ||
    goalsResultWeight < 0 ||
    goalsResultWeight > 100
  ) {
    throw new GoalsPerformanceIntegrationError(
      'Composition weights must be between 0 and 100',
    );
  }
  if (
    roundScorePercentage(competencyResultWeight + goalsResultWeight) !== 100
  ) {
    throw new GoalsPerformanceIntegrationError(
      'competencyResultWeight + goalsResultWeight must equal 100',
    );
  }
}

/**
 * Aggregate applicable GoalResults into goalsAchievement.
 * - all configuredWeight null → equal effective weights (sum 100)
 * - all configuredWeight set → weighted; must sum to 100
 * - mixed null/non-null → error (no silent invention)
 */
export function aggregateGoalsAchievement(
  goals: ApplicableGoalResultInput[],
): GoalsAggregationResult {
  if (goals.length === 0) {
    throw new GoalsPerformanceIntegrationError(
      'No existen resultados de objetivos aplicables para este colaborador.',
    );
  }

  const weights = goals.map((g) => g.configuredWeight);
  const anyWeighted = weights.some((w) => w != null);
  const allWeighted = weights.every((w) => w != null);

  if (anyWeighted && !allWeighted) {
    throw new GoalsPerformanceIntegrationError(
      'Los pesos de objetivos son inconsistentes: todos deben tener weight o ninguno',
    );
  }

  if (allWeighted) {
    const sum = roundScorePercentage(
      weights.reduce<number>((a, w) => a + (w ?? 0), 0),
    );
    if (sum !== 100) {
      throw new GoalsPerformanceIntegrationError(
        'Los pesos configurados de los objetivos aplicables deben sumar 100',
      );
    }
  }

  const effectiveRows = computeEffectiveWeights(weights);
  const snapshots = goals.map((g, idx) => {
    const effectiveWeight = effectiveRows[idx].effectiveWeight;
    const achievement = roundScorePercentage(g.achievementPercentage);
    const contribution = roundScorePercentage(
      (achievement * effectiveWeight) / 100,
    );
    return {
      sourceGoalId: g.sourceGoalId,
      sourceGoalResultId: g.sourceGoalResultId,
      goalTitle: g.goalTitle,
      goalType: g.goalType,
      achievementPercentage: achievement,
      configuredWeight: g.configuredWeight,
      effectiveWeight,
      contribution,
      order: idx,
    };
  });

  const goalsAchievement = roundScorePercentage(
    snapshots.reduce((a, s) => a + s.contribution, 0),
  );

  return { goalsAchievement, snapshots };
}

/**
 * overall = competencyScore * competencyWeight/100 + goalsAchievement * goalsWeight/100
 */
export function calculateIntegratedOverallScore(
  input: IntegratedOverallInput,
): number {
  const competencyScore = toNum(input.competencyScore, 'competencyScore');
  const goalsAchievement = toNum(input.goalsAchievement, 'goalsAchievement');
  const competencyResultWeight = toNum(
    input.competencyResultWeight,
    'competencyResultWeight',
  );
  const goalsResultWeight = toNum(input.goalsResultWeight, 'goalsResultWeight');
  assertCompositionWeights(competencyResultWeight, goalsResultWeight);

  if (competencyScore < 0 || competencyScore > 100) {
    throw new GoalsPerformanceIntegrationError(
      'competencyScore must be between 0 and 100',
    );
  }
  if (goalsAchievement < 0 || goalsAchievement > 100) {
    throw new GoalsPerformanceIntegrationError(
      'goalsAchievement must be between 0 and 100',
    );
  }

  return roundScorePercentage(
    (competencyScore * competencyResultWeight +
      goalsAchievement * goalsResultWeight) /
      100,
  );
}

/** Analytics / CSV effective overall: always PerformanceResult.overallScore. */
export function effectiveOverallScore(result: {
  overallScore: number | string;
}): number {
  return roundScorePercentage(Number(result.overallScore));
}
