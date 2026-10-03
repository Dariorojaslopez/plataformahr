import {
  PerformanceEvaluationStatus,
  PerformanceEvaluationType,
} from '@prisma/client';
import { summarizeEvaluationGroup } from './evaluation-group-summary';

describe('evaluation group summary', () => {
  it('counts statuses and averages submitted scores', () => {
    const summary = summarizeEvaluationGroup(
      [
        {
          type: PerformanceEvaluationType.PEER,
          status: PerformanceEvaluationStatus.SUBMITTED,
          scorePercentage: { toString: () => '80' },
        },
        {
          type: PerformanceEvaluationType.PEER,
          status: PerformanceEvaluationStatus.SUBMITTED,
          scorePercentage: { toString: () => '100' },
        },
        {
          type: PerformanceEvaluationType.PEER,
          status: PerformanceEvaluationStatus.PENDING,
          scorePercentage: null,
        },
        {
          type: PerformanceEvaluationType.REPORT,
          status: PerformanceEvaluationStatus.IN_PROGRESS,
          scorePercentage: null,
        },
      ],
      PerformanceEvaluationType.PEER,
    );

    expect(summary).toEqual({
      total: 3,
      submitted: 2,
      inProgress: 0,
      pending: 1,
      averageScore: '90.00',
    });
  });

  it('returns an empty group when the type is absent', () => {
    expect(
      summarizeEvaluationGroup([], PerformanceEvaluationType.CLIENT),
    ).toEqual({
      total: 0,
      submitted: 0,
      inProgress: 0,
      pending: 0,
      averageScore: null,
    });
  });
});
