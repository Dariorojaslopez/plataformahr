/**
 * Pure consolidation of evaluator individual scores into an overall result.
 * Uses persisted PerformanceEvaluation.scorePercentage (08C authority).
 * Never hardcodes 30/70 — configured weights are inputs.
 * Extra groups (PEER / REPORT / CLIENT) are averaged within type.
 */

import { roundScorePercentage } from './evaluation-score';

export type ConsolidationEvalType =
  | 'SELF'
  | 'MANAGER'
  | 'PEER'
  | 'REPORT'
  | 'CLIENT';

export type ConsolidationEvaluationInput = {
  type: ConsolidationEvalType;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED';
  scorePercentage: number | string | null;
};

export type ConsolidationInput = {
  configuredSelfWeight: number | string;
  configuredManagerWeight: number | string;
  configuredPeerWeight?: number | string | null;
  configuredReportWeight?: number | string | null;
  configuredClientWeight?: number | string | null;
  evaluations: ConsolidationEvaluationInput[];
};

export type ConsolidationResult = {
  selfScore: number | null;
  managerScore: number | null;
  peerScore: number | null;
  reportScore: number | null;
  clientScore: number | null;
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

function toWeight(value: number | string | null | undefined): number {
  if (value == null || value === '') return 0;
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

function assertConfiguredWeights(weights: number[]) {
  for (const w of weights) {
    if (w < 0 || w > 100) {
      throw new ConsolidationError(
        'Evaluator weights must be between 0 and 100',
      );
    }
  }
  const sum = weights.reduce((a, b) => a + b, 0);
  if (roundScorePercentage(sum) !== 100) {
    throw new ConsolidationError(
      'Configured evaluator weights must equal 100',
    );
  }
}

function averageScoreForType(
  evaluations: ConsolidationEvaluationInput[],
  type: ConsolidationEvalType,
): number | null {
  const ofType = evaluations.filter((e) => e.type === type);
  if (ofType.length === 0) return null;

  for (const evaluation of ofType) {
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

  const total = ofType.reduce(
    (sum, evaluation) => sum + (toScore(evaluation.scorePercentage) ?? 0),
    0,
  );
  return total / ofType.length;
}

/**
 * Consolidate existing evaluations.
 *
 * - Missing evaluation type (e.g. no MANAGER materialization): re-normalize weights.
 * - Existing incomplete evaluation: error (must be SUBMITTED).
 * - Multiple PEER/REPORT/CLIENT scores are averaged.
 */
export function calculatePerformanceResult(
  input: ConsolidationInput,
): ConsolidationResult {
  const configuredSelfWeight = toWeight(input.configuredSelfWeight);
  const configuredManagerWeight = toWeight(input.configuredManagerWeight);
  const configuredPeerWeight = toWeight(input.configuredPeerWeight);
  const configuredReportWeight = toWeight(input.configuredReportWeight);
  const configuredClientWeight = toWeight(input.configuredClientWeight);
  assertConfiguredWeights([
    configuredSelfWeight,
    configuredManagerWeight,
    configuredPeerWeight,
    configuredReportWeight,
    configuredClientWeight,
  ]);

  const selfScore = averageScoreForType(input.evaluations, 'SELF');
  const managerScore = averageScoreForType(input.evaluations, 'MANAGER');
  const peerScore = averageScoreForType(input.evaluations, 'PEER');
  const reportScore = averageScoreForType(input.evaluations, 'REPORT');
  const clientScore = averageScoreForType(input.evaluations, 'CLIENT');

  const present: Array<{ score: number; configured: number; key: string }> = [];
  if (selfScore != null) {
    present.push({ score: selfScore, configured: configuredSelfWeight, key: 'self' });
  }
  if (managerScore != null) {
    present.push({
      score: managerScore,
      configured: configuredManagerWeight,
      key: 'manager',
    });
  }
  if (peerScore != null) {
    present.push({ score: peerScore, configured: configuredPeerWeight, key: 'peer' });
  }
  if (reportScore != null) {
    present.push({
      score: reportScore,
      configured: configuredReportWeight,
      key: 'report',
    });
  }
  if (clientScore != null) {
    present.push({
      score: clientScore,
      configured: configuredClientWeight,
      key: 'client',
    });
  }

  if (present.length === 0) {
    throw new ConsolidationError('No evaluations exist for this participant');
  }

  const denom = present.reduce((sum, row) => sum + row.configured, 0);
  if (denom <= 0) {
    throw new ConsolidationError(
      'Effective evaluator weight total must be greater than zero',
    );
  }

  const effective: Record<string, number> = {
    self: 0,
    manager: 0,
    peer: 0,
    report: 0,
    client: 0,
  };
  for (const row of present) {
    effective[row.key] = roundScorePercentage((row.configured / denom) * 100);
  }
  const effectiveSum = Object.values(effective).reduce((a, b) => a + b, 0);
  if (roundScorePercentage(effectiveSum) !== 100 && present.length > 0) {
    const last = present[present.length - 1];
    const others = present
      .slice(0, -1)
      .reduce((sum, row) => sum + effective[row.key], 0);
    effective[last.key] = roundScorePercentage(100 - others);
  }

  const overallScore = roundScorePercentage(
    present.reduce(
      (sum, row) => sum + row.score * (effective[row.key] / 100),
      0,
    ),
  );

  return {
    selfScore,
    managerScore,
    peerScore,
    reportScore,
    clientScore,
    overallScore,
    configuredSelfWeight: roundScorePercentage(configuredSelfWeight),
    configuredManagerWeight: roundScorePercentage(configuredManagerWeight),
    effectiveSelfWeight: effective.self,
    effectiveManagerWeight: effective.manager,
  };
}
