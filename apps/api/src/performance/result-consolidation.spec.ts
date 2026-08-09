import {
  calculatePerformanceResult,
  ConsolidationError,
} from './result-consolidation';

describe('calculatePerformanceResult', () => {
  it('consolidates SELF 82.50 + MANAGER 76.25 at 30/70 → 78.13', () => {
    const result = calculatePerformanceResult({
      configuredSelfWeight: 30,
      configuredManagerWeight: 70,
      evaluations: [
        { type: 'SELF', status: 'SUBMITTED', scorePercentage: 82.5 },
        { type: 'MANAGER', status: 'SUBMITTED', scorePercentage: 76.25 },
      ],
    });
    expect(result.overallScore).toBe(78.13);
    expect(result.effectiveSelfWeight).toBe(30);
    expect(result.effectiveManagerWeight).toBe(70);
    expect(result.selfScore).toBe(82.5);
    expect(result.managerScore).toBe(76.25);
  });

  it('SELF-only re-normalizes configured 30/70 to effective 100/0', () => {
    const result = calculatePerformanceResult({
      configuredSelfWeight: 30,
      configuredManagerWeight: 70,
      evaluations: [
        { type: 'SELF', status: 'SUBMITTED', scorePercentage: 82.5 },
      ],
    });
    expect(result.overallScore).toBe(82.5);
    expect(result.effectiveSelfWeight).toBe(100);
    expect(result.effectiveManagerWeight).toBe(0);
    expect(result.managerScore).toBeNull();
  });

  it('supports MANAGER-only when SELF was not materialized', () => {
    const result = calculatePerformanceResult({
      configuredSelfWeight: 30,
      configuredManagerWeight: 70,
      evaluations: [
        { type: 'MANAGER', status: 'SUBMITTED', scorePercentage: 88 },
      ],
    });
    expect(result.overallScore).toBe(88);
    expect(result.effectiveSelfWeight).toBe(0);
    expect(result.effectiveManagerWeight).toBe(100);
  });

  it('supports SELF weight 0 / MANAGER 100', () => {
    const result = calculatePerformanceResult({
      configuredSelfWeight: 0,
      configuredManagerWeight: 100,
      evaluations: [
        { type: 'SELF', status: 'SUBMITTED', scorePercentage: 50 },
        { type: 'MANAGER', status: 'SUBMITTED', scorePercentage: 88.25 },
      ],
    });
    expect(result.overallScore).toBe(88.25);
    expect(result.effectiveSelfWeight).toBe(0);
    expect(result.effectiveManagerWeight).toBe(100);
  });

  it('supports MANAGER weight 0 / SELF 100', () => {
    const result = calculatePerformanceResult({
      configuredSelfWeight: 100,
      configuredManagerWeight: 0,
      evaluations: [
        { type: 'SELF', status: 'SUBMITTED', scorePercentage: 91 },
        { type: 'MANAGER', status: 'SUBMITTED', scorePercentage: 10 },
      ],
    });
    expect(result.overallScore).toBe(91);
  });

  it('supports 20/80 weights', () => {
    const result = calculatePerformanceResult({
      configuredSelfWeight: 20,
      configuredManagerWeight: 80,
      evaluations: [
        { type: 'SELF', status: 'SUBMITTED', scorePercentage: 100 },
        { type: 'MANAGER', status: 'SUBMITTED', scorePercentage: 50 },
      ],
    });
    // 100*0.2 + 50*0.8 = 60
    expect(result.overallScore).toBe(60);
  });

  it('handles score 0 and 100', () => {
    expect(
      calculatePerformanceResult({
        configuredSelfWeight: 50,
        configuredManagerWeight: 50,
        evaluations: [
          { type: 'SELF', status: 'SUBMITTED', scorePercentage: 0 },
          { type: 'MANAGER', status: 'SUBMITTED', scorePercentage: 100 },
        ],
      }).overallScore,
    ).toBe(50);
  });

  it('rejects invalid configured sum', () => {
    expect(() =>
      calculatePerformanceResult({
        configuredSelfWeight: 40,
        configuredManagerWeight: 40,
        evaluations: [
          { type: 'SELF', status: 'SUBMITTED', scorePercentage: 80 },
        ],
      }),
    ).toThrow(ConsolidationError);
  });

  it('rejects no evaluations', () => {
    expect(() =>
      calculatePerformanceResult({
        configuredSelfWeight: 30,
        configuredManagerWeight: 70,
        evaluations: [],
      }),
    ).toThrow(/No evaluations/);
  });

  it('rejects incomplete existing MANAGER', () => {
    expect(() =>
      calculatePerformanceResult({
        configuredSelfWeight: 30,
        configuredManagerWeight: 70,
        evaluations: [
          { type: 'SELF', status: 'SUBMITTED', scorePercentage: 80 },
          { type: 'MANAGER', status: 'IN_PROGRESS', scorePercentage: null },
        ],
      }),
    ).toThrow(/SUBMITTED/);
  });

  it('rejects missing scorePercentage on SUBMITTED', () => {
    expect(() =>
      calculatePerformanceResult({
        configuredSelfWeight: 30,
        configuredManagerWeight: 70,
        evaluations: [
          { type: 'SELF', status: 'SUBMITTED', scorePercentage: null },
        ],
      }),
    ).toThrow(/scorePercentage/);
  });
});
