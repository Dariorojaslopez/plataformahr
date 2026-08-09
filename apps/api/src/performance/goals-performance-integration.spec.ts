import {
  aggregateGoalsAchievement,
  assertCompositionWeights,
  calculateIntegratedOverallScore,
} from './goals-performance-integration';

describe('goals-performance-integration', () => {
  it('1 goal', () => {
    const r = aggregateGoalsAchievement([
      {
        sourceGoalId: 'g1',
        sourceGoalResultId: 'r1',
        goalTitle: 'A',
        goalType: 'INDIVIDUAL',
        achievementPercentage: 80,
        configuredWeight: null,
      },
    ]);
    expect(r.goalsAchievement).toBe(80);
    expect(r.snapshots[0].effectiveWeight).toBe(100);
  });

  it('varios unweighted', () => {
    const r = aggregateGoalsAchievement([
      {
        sourceGoalId: 'g1',
        sourceGoalResultId: 'r1',
        goalTitle: 'A',
        goalType: 'INDIVIDUAL',
        achievementPercentage: 80,
        configuredWeight: null,
      },
      {
        sourceGoalId: 'g2',
        sourceGoalResultId: 'r2',
        goalTitle: 'B',
        goalType: 'COMPANY',
        achievementPercentage: 100,
        configuredWeight: null,
      },
    ]);
    expect(r.goalsAchievement).toBe(90);
    expect(r.snapshots.map((s) => s.effectiveWeight)).toEqual([50, 50]);
  });

  it('varios weighted', () => {
    const r = aggregateGoalsAchievement([
      {
        sourceGoalId: 'g1',
        sourceGoalResultId: 'r1',
        goalTitle: 'A',
        goalType: 'INDIVIDUAL',
        achievementPercentage: 80,
        configuredWeight: 60,
      },
      {
        sourceGoalId: 'g2',
        sourceGoalResultId: 'r2',
        goalTitle: 'B',
        goalType: 'AREA',
        achievementPercentage: 100,
        configuredWeight: 40,
      },
    ]);
    expect(r.goalsAchievement).toBe(88);
  });

  it('rounding / 0 / 100', () => {
    expect(
      aggregateGoalsAchievement([
        {
          sourceGoalId: 'g1',
          sourceGoalResultId: 'r1',
          goalTitle: 'A',
          goalType: 'INDIVIDUAL',
          achievementPercentage: 0,
          configuredWeight: null,
        },
      ]).goalsAchievement,
    ).toBe(0);
    expect(
      aggregateGoalsAchievement([
        {
          sourceGoalId: 'g1',
          sourceGoalResultId: 'r1',
          goalTitle: 'A',
          goalType: 'INDIVIDUAL',
          achievementPercentage: 100,
          configuredWeight: null,
        },
      ]).goalsAchievement,
    ).toBe(100);
  });

  it('invalid mixed weighting', () => {
    expect(() =>
      aggregateGoalsAchievement([
        {
          sourceGoalId: 'g1',
          sourceGoalResultId: 'r1',
          goalTitle: 'A',
          goalType: 'INDIVIDUAL',
          achievementPercentage: 80,
          configuredWeight: 60,
        },
        {
          sourceGoalId: 'g2',
          sourceGoalResultId: 'r2',
          goalTitle: 'B',
          goalType: 'COMPANY',
          achievementPercentage: 100,
          configuredWeight: null,
        },
      ]),
    ).toThrow(/inconsistentes/i);
  });

  it('goal weight null policy: equal shares', () => {
    const r = aggregateGoalsAchievement([
      {
        sourceGoalId: 'g1',
        sourceGoalResultId: 'r1',
        goalTitle: 'A',
        goalType: 'INDIVIDUAL',
        achievementPercentage: 50,
        configuredWeight: null,
      },
      {
        sourceGoalId: 'g2',
        sourceGoalResultId: 'r2',
        goalTitle: 'B',
        goalType: 'INDIVIDUAL',
        achievementPercentage: 100,
        configuredWeight: null,
      },
      {
        sourceGoalId: 'g3',
        sourceGoalResultId: 'r3',
        goalTitle: 'C',
        goalType: 'INDIVIDUAL',
        achievementPercentage: 75,
        configuredWeight: null,
      },
    ]);
    expect(r.snapshots.reduce((a, s) => a + s.effectiveWeight, 0)).toBe(100);
  });

  it('70/30 integrated overall', () => {
    expect(
      calculateIntegratedOverallScore({
        competencyScore: 80,
        goalsAchievement: 90,
        competencyResultWeight: 70,
        goalsResultWeight: 30,
      }),
    ).toBe(83);
  });

  it('goalsResultWeight 0 → overall = competency', () => {
    expect(
      calculateIntegratedOverallScore({
        competencyScore: 77.5,
        goalsAchievement: 10,
        competencyResultWeight: 100,
        goalsResultWeight: 0,
      }),
    ).toBe(77.5);
  });

  it('competencyResultWeight 0 → overall = goals', () => {
    expect(
      calculateIntegratedOverallScore({
        competencyScore: 50,
        goalsAchievement: 92,
        competencyResultWeight: 0,
        goalsResultWeight: 100,
      }),
    ).toBe(92);
  });

  it('legacy competency-only composition weights', () => {
    expect(() => assertCompositionWeights(70, 30)).not.toThrow();
    expect(() => assertCompositionWeights(50, 40)).toThrow(/100/);
  });

  it('empty goals rejected', () => {
    expect(() => aggregateGoalsAchievement([])).toThrow(/aplicables/i);
  });
});
