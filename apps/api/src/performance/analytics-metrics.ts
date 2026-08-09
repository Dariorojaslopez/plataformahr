import { roundScorePercentage } from './evaluation-score';

export type ParticipantStatusCount = {
  ACTIVE: number;
  COMPLETED: number;
  EXCLUDED: number;
};

export type EvaluationTypeMetrics = {
  total: number;
  pending: number;
  inProgress: number;
  submitted: number;
  submittedRate: number;
};

export type DistributionBucket = {
  key: string;
  label: string;
  from: number;
  to: number;
  /** Inclusive lower bound; last bucket includes 100. */
  count: number;
  percentage: number;
};

/** Buckets: [0,20) [20,40) [40,60) [60,80) [80,100] — no qualitative meaning. */
export const SCORE_DISTRIBUTION_BUCKETS = [
  { key: '0-20', label: '0–19.99', from: 0, to: 20, includesTo: false },
  { key: '20-40', label: '20–39.99', from: 20, to: 40, includesTo: false },
  { key: '40-60', label: '40–59.99', from: 40, to: 60, includesTo: false },
  { key: '60-80', label: '60–79.99', from: 60, to: 80, includesTo: false },
  { key: '80-100', label: '80–100', from: 80, to: 100, includesTo: true },
] as const;

export function completionRate(params: {
  completed: number;
  active: number;
}): number {
  const eligible = params.completed + params.active;
  if (eligible === 0) return 0;
  return roundScorePercentage((params.completed / eligible) * 100);
}

export function submissionRate(submitted: number, total: number): number {
  if (total === 0) return 0;
  return roundScorePercentage((submitted / total) * 100);
}

export function releaseRate(released: number, totalResults: number): number {
  if (totalResults === 0) return 0;
  return roundScorePercentage((released / totalResults) * 100);
}

export function buildParticipantMetrics(counts: ParticipantStatusCount) {
  const totalParticipants = counts.ACTIVE + counts.COMPLETED + counts.EXCLUDED;
  const eligibleParticipants = counts.ACTIVE + counts.COMPLETED;
  return {
    totalParticipants,
    activeParticipants: counts.ACTIVE,
    completedParticipants: counts.COMPLETED,
    excludedParticipants: counts.EXCLUDED,
    eligibleParticipants,
    completionRate: completionRate({
      completed: counts.COMPLETED,
      active: counts.ACTIVE,
    }),
  };
}

export function buildEvaluationTypeMetrics(params: {
  pending: number;
  inProgress: number;
  submitted: number;
}): EvaluationTypeMetrics {
  const total = params.pending + params.inProgress + params.submitted;
  return {
    total,
    pending: params.pending,
    inProgress: params.inProgress,
    submitted: params.submitted,
    submittedRate: submissionRate(params.submitted, total),
  };
}

export function averageScores(scores: number[]): number | null {
  if (scores.length === 0) return null;
  const sum = scores.reduce((a, b) => a + b, 0);
  return roundScorePercentage(sum / scores.length);
}

export function minMaxScores(scores: number[]): {
  minScore: number | null;
  maxScore: number | null;
} {
  if (scores.length === 0) return { minScore: null, maxScore: null };
  return {
    minScore: roundScorePercentage(Math.min(...scores)),
    maxScore: roundScorePercentage(Math.max(...scores)),
  };
}

export function bucketForScore(score: number): string {
  for (const bucket of SCORE_DISTRIBUTION_BUCKETS) {
    if (bucket.includesTo) {
      if (score >= bucket.from && score <= bucket.to) return bucket.key;
    } else if (score >= bucket.from && score < bucket.to) {
      return bucket.key;
    }
  }
  // Clamp out-of-range into edges for safety.
  if (score < 0) return SCORE_DISTRIBUTION_BUCKETS[0].key;
  return SCORE_DISTRIBUTION_BUCKETS[SCORE_DISTRIBUTION_BUCKETS.length - 1].key;
}

export function buildScoreDistribution(scores: number[]): DistributionBucket[] {
  const counts = new Map<string, number>();
  for (const bucket of SCORE_DISTRIBUTION_BUCKETS) {
    counts.set(bucket.key, 0);
  }
  for (const score of scores) {
    const key = bucketForScore(score);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = scores.length;
  return SCORE_DISTRIBUTION_BUCKETS.map((bucket) => {
    const count = counts.get(bucket.key) ?? 0;
    return {
      key: bucket.key,
      label: bucket.label,
      from: bucket.from,
      to: bucket.to,
      count,
      percentage: total === 0 ? 0 : roundScorePercentage((count / total) * 100),
    };
  });
}

export type OrgBreakdownRow = {
  id: string | null;
  name: string;
  resultCount: number;
  averageScore: number | null;
};

export function buildOrgBreakdown(
  rows: Array<{ id: string | null; name: string | null; score: number }>,
  emptyLabel: string,
): OrgBreakdownRow[] {
  const groups = new Map<
    string,
    { id: string | null; name: string; scores: number[] }
  >();

  for (const row of rows) {
    const id = row.id;
    const name = row.name?.trim() ? row.name : emptyLabel;
    const key = id ?? `__null__:${emptyLabel}`;
    const existing = groups.get(key);
    if (existing) {
      existing.scores.push(row.score);
    } else {
      groups.set(key, { id, name, scores: [row.score] });
    }
  }

  return [...groups.values()]
    .map((g) => ({
      id: g.id,
      name: g.name,
      resultCount: g.scores.length,
      averageScore: averageScores(g.scores),
    }))
    .sort((a, b) => {
      if (b.resultCount !== a.resultCount) return b.resultCount - a.resultCount;
      return a.name.localeCompare(b.name);
    });
}
