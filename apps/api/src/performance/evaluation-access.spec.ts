import {
  PerformanceEvaluationStatus,
  PerformanceEvaluationType,
  PerformanceParticipantStatus,
} from '@prisma/client';
import {
  canAccessEvaluation,
  canExcludeParticipant,
  canRespondToEvaluation,
  NO_DIRECT_MANAGER,
  resolveEvaluatorForType,
  snapshotFingerprint,
  type SnapshotCompetencyInput,
} from './evaluation-access';

describe('evaluation access helpers', () => {
  const baseEval = {
    employeeId: 'emp-a',
    evaluatorEmployeeId: 'mgr-b',
    type: PerformanceEvaluationType.MANAGER,
  };

  it('allows manage permission without being subject/evaluator', () => {
    expect(
      canAccessEvaluation({
        hasManagePermission: true,
        actorEmployeeId: null,
        evaluation: baseEval,
      }),
    ).toBe(true);
  });

  it('allows SELF subject and MANAGER evaluator only', () => {
    expect(
      canAccessEvaluation({
        hasManagePermission: false,
        actorEmployeeId: 'emp-a',
        evaluation: {
          employeeId: 'emp-a',
          evaluatorEmployeeId: 'emp-a',
          type: PerformanceEvaluationType.SELF,
        },
      }),
    ).toBe(true);

    expect(
      canAccessEvaluation({
        hasManagePermission: false,
        actorEmployeeId: 'other',
        evaluation: {
          employeeId: 'emp-a',
          evaluatorEmployeeId: 'emp-a',
          type: PerformanceEvaluationType.SELF,
        },
      }),
    ).toBe(false);

    expect(
      canAccessEvaluation({
        hasManagePermission: false,
        actorEmployeeId: 'mgr-b',
        evaluation: baseEval,
      }),
    ).toBe(true);

    expect(
      canAccessEvaluation({
        hasManagePermission: false,
        actorEmployeeId: 'emp-a',
        evaluation: baseEval,
      }),
    ).toBe(false);
  });

  it('blocks exclude when already excluded or submitted', () => {
    expect(
      canExcludeParticipant({
        participantStatus: PerformanceParticipantStatus.ACTIVE,
        evaluationStatuses: [PerformanceEvaluationStatus.PENDING],
      }),
    ).toBe(true);

    expect(
      canExcludeParticipant({
        participantStatus: PerformanceParticipantStatus.EXCLUDED,
        evaluationStatuses: [PerformanceEvaluationStatus.PENDING],
      }),
    ).toBe(false);

    expect(
      canExcludeParticipant({
        participantStatus: PerformanceParticipantStatus.ACTIVE,
        evaluationStatuses: [PerformanceEvaluationStatus.SUBMITTED],
      }),
    ).toBe(false);
  });

  it('allows respond only for evaluator with respond permission (no manage impersonation)', () => {
    expect(
      canRespondToEvaluation({
        hasRespondPermission: true,
        actorEmployeeId: 'mgr-b',
        evaluatorEmployeeId: 'mgr-b',
      }),
    ).toBe(true);

    expect(
      canRespondToEvaluation({
        hasRespondPermission: true,
        actorEmployeeId: 'admin-emp',
        evaluatorEmployeeId: 'mgr-b',
      }),
    ).toBe(false);

    expect(
      canRespondToEvaluation({
        hasRespondPermission: false,
        actorEmployeeId: 'mgr-b',
        evaluatorEmployeeId: 'mgr-b',
      }),
    ).toBe(false);

    expect(
      canRespondToEvaluation({
        hasRespondPermission: true,
        actorEmployeeId: null,
        evaluatorEmployeeId: 'mgr-b',
      }),
    ).toBe(false);
  });

  it('resolves evaluators and snapshot fingerprints', () => {
    expect(
      resolveEvaluatorForType({
        type: PerformanceEvaluationType.SELF,
        employeeId: 'a',
        managerEmployeeId: 'm',
      }),
    ).toBe('a');
    expect(
      resolveEvaluatorForType({
        type: PerformanceEvaluationType.MANAGER,
        employeeId: 'a',
        managerEmployeeId: null,
      }),
    ).toBeNull();
    expect(NO_DIRECT_MANAGER).toBe('NO_DIRECT_MANAGER');

    const snap: SnapshotCompetencyInput[] = [
      {
        sourceCompetencyId: 'c1',
        sourceScaleId: 's1',
        name: 'Liderazgo',
        code: 'LID',
        description: 'desc',
        scaleName: '1-5',
        weight: '25',
        required: true,
        order: 0,
        levels: [
          {
            sourceScaleLevelId: 'l1',
            value: 1,
            label: 'Insuficiente',
            description: null,
            order: 1,
          },
        ],
      },
    ];
    expect(snapshotFingerprint(snap)).toBe(snapshotFingerprint([...snap]));
  });
});
