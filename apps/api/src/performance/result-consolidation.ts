/**
 * Pure consolidation of SELF/MANAGER individual scores into an overall result.
 * Uses persisted PerformanceEvaluation.scorePercentage (08C authority).
 * Never hardcodes 30/70 — configured weights are inputs.
 */

import { roundScorePercentage } from './evaluation-score';

export type ConsolidationEvaluationInput = {
  type: 'SELF' | 'MANAGER';
  status: 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED';
  scorePercentage: number | string | null;
};

export type ConsolidationInput = {
  configuredSelfWeight: number | string;
  configuredManagerWeight: number | string;
  evaluations: ConsolidationEvaluationInput[];
};

export type ConsolidationResult = {
  selfScore: number | null;
  managerScore: number | null;
  overallScore: number;
  configuredSelfWeight: number;
  configuredManagerWeight: number;
  effectiveSelfWeight: number;
  effectiveManagerWeight: number;
};

export class ConsolidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConsolidationError';
  }
}

function toWeight(value: number | string): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) {
    throw new ConsolidationError('Invalid evaluator weight');
  }
  return n;
}

function toScore(value: number | string | null): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) {
    throw new ConsolidationError('Invalid evaluation scorePercentage');
  }
  return n;
}

function assertConfiguredWeights(selfW: number, managerW: number) {
  if (selfW < 0 || selfW > 100 || managerW < 0 || managerW > 100) {
    throw new ConsolidationError('Evaluator weights must be between 0 and 100');
  }
  if (roundScorePercentage(selfW + managerW) !== 100) {
    throw new ConsolidationError(
      'Configured selfEvaluationWeight + managerEvaluationWeight must equal 100',
    );
  }
}

/**
 * Consolidate existing evaluations.
 *
 * - Missing evaluation type (e.g. no MANAGER materialization): re-normalize weights.
 * - Existing incomplete evaluation: error (must be SUBMITTED).
 * - Weight 0 evaluations that exist must still be SUBMITTED.
 */
export function calculatePerformanceResult(
  input: ConsolidationInput,
): ConsolidationResult {
  const configuredSelfWeight = toWeight(input.configuredSelfWeight);
  const configuredManagerWeight = toWeight(input.configuredManagerWeight);
  assertConfiguredWeights(configuredSelfWeight, configuredManagerWeight);

  const selfEval = input.evaluations.find((e) => e.type === 'SELF') ?? null;
  const managerEval =
    input.evaluations.find((e) => e.type === 'MANAGER') ?? null;

  if (!selfEval && !managerEval) {
    throw new ConsolidationError('No evaluations exist for this participant');
  }

  for (const evaluation of [selfEval, managerEval]) {
    if (!evaluation) continue;
    if (evaluation.status !== 'SUBMITTED') {
      throw new ConsolidationError(
        `All existing evaluations must be SUBMITTED before consolidation (${evaluation.type} is ${evaluation.status})`,
      );
    }
    if (toScore(evaluation.scorePercentage) == null) {
      throw new ConsolidationError(
        `Submitted evaluation ${evaluation.type} is missing scorePercentage`,
      );
    }
  }

  const selfScore = selfEval ? toScore(selfEval.scorePercentage) : null;
  const managerScore = managerEval
    ? toScore(managerEval.scorePercentage)
    : null;

  let effectiveSelfWeight = selfEval ? configuredSelfWeight : 0;
  let effectiveManagerWeight = managerEval ? configuredManagerWeight : 0;
  const denom = effectiveSelfWeight + effectiveManagerWeight;
  if (denom <= 0) {
    throw new ConsolidationError(
      'Effective evaluator weight total must be greater than zero',
    );
  }

  // Re-normalize among existing evaluation types.
  effectiveSelfWeight = roundScorePercentage(
    (effectiveSelfWeight / denom) * 100,
  );
  effectiveManagerWeight = roundScorePercentage(
    (effectiveManagerWeight / denom) * 100,
  );
  // Keep sum exactly 100 after rounding edge cases.
  if (
    roundScorePercentage(effectiveSelfWeight + effectiveManagerWeight) !== 100
  ) {
    if (selfEval && !managerEval) {
      effectiveSelfWeight = 100;
      effectiveManagerWeight = 0;
    } else if (managerEval && !selfEval) {
      effectiveSelfWeight = 0;
      effectiveManagerWeight = 100;
    } else {
      effectiveManagerWeight = roundScorePercentage(100 - effectiveSelfWeight);
    }
  }

  const overallScore = roundScorePercentage(
    ((selfScore ?? 0) * effectiveSelfWeight +
      (managerScore ?? 0) * effectiveManagerWeight) /
      100,
  );

  return {
    selfScore,
    managerScore,
    overallScore,
    configuredSelfWeight: roundScorePercentage(configuredSelfWeight),
    configuredManagerWeight: roundScorePercentage(configuredManagerWeight),
    effectiveSelfWeight,
    effectiveManagerWeight,
  };
}
