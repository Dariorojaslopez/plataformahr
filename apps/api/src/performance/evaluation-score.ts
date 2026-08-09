/**
 * Pure score calculation for a single PerformanceEvaluation (SELF or MANAGER).
 * Uses snapshot levels + responses only — never the live catalog.
 *
 * Score authority at submit: scorePercentage 0.00–100.00 (2 decimals).
 * SELF and MANAGER scores stay independent (no consolidation in 08C).
 */

export type ScoreCompetencyInput = {
  id: string;
  required: boolean;
  /** Null/undefined for all → unweighted average of responded competencies. */
  weight: number | string | null | undefined;
  levels: Array<{ value: number }>;
  response: { ratingValue: number } | null;
};

export type ScoreCompetencyBreakdown = {
  evaluationCompetencyId: string;
  ratingValue: number;
  normalizedPercentage: number;
  weight: number | null;
  /** Contribution after renormalization among answered competencies (weighted only). */
  weightedContribution: number | null;
};

export type EvaluationScoreResult = {
  scorePercentage: number;
  weighted: boolean;
  answeredCount: number;
  breakdown: ScoreCompetencyBreakdown[];
};

export class ScoreCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScoreCalculationError';
  }
}

function toNumber(weight: number | string | null | undefined): number | null {
  if (weight == null || weight === '') return null;
  const n = typeof weight === 'number' ? weight : Number(weight);
  if (!Number.isFinite(n)) {
    throw new ScoreCalculationError('Invalid competency weight');
  }
  return n;
}

/** Round half-up to 2 decimal places without float noise. */
export function roundScorePercentage(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function normalizeRatingToUnit(
  ratingValue: number,
  levelValues: number[],
): number {
  if (levelValues.length < 2) {
    throw new ScoreCalculationError(
      'Scale snapshot must have at least 2 levels',
    );
  }
  const minValue = Math.min(...levelValues);
  const maxValue = Math.max(...levelValues);
  if (maxValue <= minValue) {
    throw new ScoreCalculationError(
      'Scale snapshot maxValue must be greater than minValue',
    );
  }
  if (ratingValue < minValue || ratingValue > maxValue) {
    throw new ScoreCalculationError(
      'Rating value outside snapshot scale range',
    );
  }
  return (ratingValue - minValue) / (maxValue - minValue);
}

/**
 * Calculate individual evaluation score.
 *
 * Unweighted: average of normalized percentages of answered competencies.
 * Weighted: renormalize weights among answered competencies only
 * (optional unanswered does not count as zero).
 */
export function calculateEvaluationScore(
  competencies: ScoreCompetencyInput[],
): EvaluationScoreResult {
  const answered = competencies.filter((c) => c.response != null);
  if (answered.length === 0) {
    throw new ScoreCalculationError(
      'La evaluación debe tener al menos una respuesta.',
    );
  }

  const anyWeight = competencies.some((c) => toNumber(c.weight) != null);
  if (anyWeight) {
    const missingWeight = answered.find((c) => toNumber(c.weight) == null);
    if (missingWeight) {
      throw new ScoreCalculationError(
        'Weighted evaluation requires weight on every answered competency',
      );
    }
  }

  const breakdown: ScoreCompetencyBreakdown[] = [];
  let weightedSum = 0;
  let weightTotal = 0;
  let unweightedSum = 0;

  for (const c of answered) {
    const ratingValue = c.response!.ratingValue;
    const unit = normalizeRatingToUnit(
      ratingValue,
      c.levels.map((l) => l.value),
    );
    const normalizedPercentage = unit * 100;
    const weight = toNumber(c.weight);

    breakdown.push({
      evaluationCompetencyId: c.id,
      ratingValue,
      normalizedPercentage: roundScorePercentage(normalizedPercentage),
      weight,
      weightedContribution: null,
    });

    if (anyWeight && weight != null) {
      weightedSum += unit * weight;
      weightTotal += weight;
    } else {
      unweightedSum += normalizedPercentage;
    }
  }

  let scorePercentage: number;
  if (anyWeight) {
    if (weightTotal <= 0) {
      throw new ScoreCalculationError(
        'Effective weight total must be greater than zero',
      );
    }
    // unit*weight / weightTotal → 0–1, then *100
    scorePercentage = (weightedSum / weightTotal) * 100;
    for (const row of breakdown) {
      if (row.weight != null) {
        row.weightedContribution = roundScorePercentage(
          (((row.normalizedPercentage / 100) * row.weight) / weightTotal) * 100,
        );
      }
    }
  } else {
    scorePercentage = unweightedSum / answered.length;
  }

  return {
    scorePercentage: roundScorePercentage(scorePercentage),
    weighted: anyWeight,
    answeredCount: answered.length,
    breakdown,
  };
}
