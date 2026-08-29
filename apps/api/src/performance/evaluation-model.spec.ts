import { PerformanceEvaluationModel } from '@prisma/client';
import {
  evaluatorRolesForModel,
  isEvaluationRange,
  modelIncludesClient,
  modelIncludesPeer,
  modelIncludesReport,
} from './evaluation-model';

describe('evaluation model', () => {
  it('enables extra groups from 180° upward', () => {
    expect(evaluatorRolesForModel(PerformanceEvaluationModel.DEGREE_90)).toEqual(
      ['self', 'manager'],
    );
    expect(evaluatorRolesForModel(PerformanceEvaluationModel.DEGREE_180)).toEqual(
      ['self', 'manager', 'peer'],
    );
    expect(evaluatorRolesForModel(PerformanceEvaluationModel.DEGREE_270)).toEqual(
      ['self', 'manager', 'peer', 'report'],
    );
    expect(evaluatorRolesForModel(PerformanceEvaluationModel.DEGREE_360)).toEqual(
      ['self', 'manager', 'peer', 'report', 'client'],
    );
  });

  it('maps extra roles by model', () => {
    expect(modelIncludesPeer(PerformanceEvaluationModel.DEGREE_90)).toBe(false);
    expect(modelIncludesPeer(PerformanceEvaluationModel.DEGREE_180)).toBe(true);
    expect(modelIncludesReport(PerformanceEvaluationModel.DEGREE_180)).toBe(
      false,
    );
    expect(modelIncludesReport(PerformanceEvaluationModel.DEGREE_270)).toBe(
      true,
    );
    expect(modelIncludesClient(PerformanceEvaluationModel.DEGREE_270)).toBe(
      false,
    );
    expect(modelIncludesClient(PerformanceEvaluationModel.DEGREE_360)).toBe(
      true,
    );
  });

  it('accepts 100 and 120 ranges', () => {
    expect(isEvaluationRange(100)).toBe(true);
    expect(isEvaluationRange(120)).toBe(true);
    expect(isEvaluationRange(110)).toBe(false);
  });
});
