import {
  averageScores,
  bucketForScore,
  buildOrgBreakdown,
  buildParticipantMetrics,
  buildScoreDistribution,
  buildEvaluationTypeMetrics,
  completionRate,
  minMaxScores,
  releaseRate,
  submissionRate,
} from './analytics-metrics';

describe('analytics metrics helpers', () => {
  it('computes completion rate excluding EXCLUDED from denominator', () => {
    expect(completionRate({ completed: 2, active: 2 })).toBe(50);
    expect(
      buildParticipantMetrics({
        ACTIVE: 1,
        COMPLETED: 3,
        EXCLUDED: 10,
      }).completionRate,
    ).toBe(75);
    expect(completionRate({ completed: 0, active: 0 })).toBe(0);
  });

  it('computes submission and release rates with zero denominator', () => {
    expect(submissionRate(0, 0)).toBe(0);
    expect(submissionRate(3, 4)).toBe(75);
    expect(releaseRate(0, 0)).toBe(0);
    expect(releaseRate(1, 4)).toBe(25);
  });

  it('builds evaluation type metrics', () => {
    expect(
      buildEvaluationTypeMetrics({
        pending: 1,
        inProgress: 1,
        submitted: 2,
      }),
    ).toEqual({
      total: 4,
      pending: 1,
      inProgress: 1,
      submitted: 2,
      submittedRate: 50,
    });
  });

  it('returns null average/min/max without scores', () => {
    expect(averageScores([])).toBeNull();
    expect(minMaxScores([])).toEqual({ minScore: null, maxScore: null });
  });

  it('averages and min/max with rounding', () => {
    expect(averageScores([80, 90])).toBe(85);
    expect(minMaxScores([80, 90, 70])).toEqual({
      minScore: 70,
      maxScore: 90,
    });
  });

  it('places distribution boundaries correctly', () => {
    expect(bucketForScore(0)).toBe('0-20');
    expect(bucketForScore(19.99)).toBe('0-20');
    expect(bucketForScore(20)).toBe('20-40');
    expect(bucketForScore(39.99)).toBe('20-40');
    expect(bucketForScore(40)).toBe('40-60');
    expect(bucketForScore(59.99)).toBe('40-60');
    expect(bucketForScore(60)).toBe('60-80');
    expect(bucketForScore(79.99)).toBe('60-80');
    expect(bucketForScore(80)).toBe('80-100');
    expect(bucketForScore(99.99)).toBe('80-100');
    expect(bucketForScore(100)).toBe('80-100');
  });

  it('builds distribution counts and percentages', () => {
    const dist = buildScoreDistribution([10, 25, 50, 70, 90, 100]);
    expect(dist.find((b) => b.key === '0-20')?.count).toBe(1);
    expect(dist.find((b) => b.key === '80-100')?.count).toBe(2);
    expect(dist.find((b) => b.key === '80-100')?.percentage).toBe(33.33);
  });

  it('groups org breakdown with empty label and sorts by resultCount', () => {
    const rows = buildOrgBreakdown(
      [
        { id: 'a', name: 'Area A', score: 80 },
        { id: 'a', name: 'Area A', score: 90 },
        { id: null, name: null, score: 70 },
      ],
      'Sin área',
    );
    expect(rows[0]).toMatchObject({
      id: 'a',
      name: 'Area A',
      resultCount: 2,
      averageScore: 85,
    });
    expect(rows[1]).toMatchObject({
      id: null,
      name: 'Sin área',
      resultCount: 1,
      averageScore: 70,
    });
  });
});
