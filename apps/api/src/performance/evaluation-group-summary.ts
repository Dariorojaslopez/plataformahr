import {
  PerformanceEvaluationStatus,
  PerformanceEvaluationType,
} from '@prisma/client';

export type EvaluationGroupSummary = {
  total: number;
  submitted: number;
  inProgress: number;
  pending: number;
  averageScore: string | null;
};

type GroupEvaluation = {
  type: PerformanceEvaluationType;
  status: PerformanceEvaluationStatus;
  scorePercentage?: { toString(): string } | null;
};

export function summarizeEvaluationGroup(
  evaluations: GroupEvaluation[],
  type: PerformanceEvaluationType,
): EvaluationGroupSummary {
  const group = evaluations.filter((evaluation) => evaluation.type === type);
  const submitted = group.filter(
    (evaluation) => evaluation.status === PerformanceEvaluationStatus.SUBMITTED,
  );
  const scores = submitted
    .map((evaluation) => {
      if (evaluation.scorePercentage == null) return null;
      const value = Number(evaluation.scorePercentage.toString());
      return Number.isFinite(value) ? value : null;
    })
    .filter((value): value is number => value != null);
  const average =
    scores.length > 0
      ? scores.reduce((sum, value) => sum + value, 0) / scores.length
      : null;

  return {
    total: group.length,
    submitted: submitted.length,
    inProgress: group.filter(
      (evaluation) =>
        evaluation.status === PerformanceEvaluationStatus.IN_PROGRESS,
    ).length,
    pending: group.filter(
      (evaluation) => evaluation.status === PerformanceEvaluationStatus.PENDING,
    ).length,
    averageScore: average == null ? null : average.toFixed(2),
  };
}
