import {
  buildCyclePhases,
  canEditEvaluationInCyclePhase,
  canEditGoalsInCyclePhase,
} from './cycle-phases';

describe('cycle phases', () => {
  it('marks only the current window as editable for split eval phases', () => {
    const phases = buildCyclePhases(
      {
        status: 'ACTIVE',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        evaluationStartDate: '2026-03-01',
        evaluationEndDate: '2026-03-31',
        managerEvaluationStartDate: '2026-04-01',
        managerEvaluationEndDate: '2026-04-30',
      },
      '2026-03-10',
    );
    expect(
      canEditEvaluationInCyclePhase({
        cycleStatus: 'ACTIVE',
        evaluationType: 'SELF',
        phases,
      }),
    ).toBe(true);
    expect(
      canEditEvaluationInCyclePhase({
        cycleStatus: 'ACTIVE',
        evaluationType: 'MANAGER',
        phases,
      }),
    ).toBe(false);
  });

  it('keeps legacy cycles without windows writable while ACTIVE', () => {
    const phases = buildCyclePhases(
      {
        status: 'ACTIVE',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
      '2026-06-01',
    );
    expect(phases).toHaveLength(0);
    expect(
      canEditEvaluationInCyclePhase({
        cycleStatus: 'ACTIVE',
        evaluationType: 'PEER',
        phases,
      }),
    ).toBe(true);
  });

  it('allows goal definition edits only in that current window', () => {
    const phases = buildCyclePhases(
      {
        status: 'ACTIVE',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        goalDefinitionStartDate: '2026-02-01',
        goalDefinitionEndDate: '2026-02-28',
      },
      '2026-02-10',
    );
    expect(
      canEditGoalsInCyclePhase({
        cycleStatus: 'ACTIVE',
        phases,
        kind: 'GOAL_DEFINITION',
      }),
    ).toBe(true);
    expect(
      canEditGoalsInCyclePhase({
        cycleStatus: 'ACTIVE',
        phases,
        kind: 'FOLLOW_UP',
      }),
    ).toBe(false);
  });
});
