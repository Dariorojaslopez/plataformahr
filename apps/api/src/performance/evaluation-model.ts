import { PerformanceEvaluationModel } from '@prisma/client';

export const EVALUATION_RANGES = [100, 120] as const;
export type EvaluationRange = (typeof EVALUATION_RANGES)[number];

export type EvaluatorRole = 'self' | 'manager' | 'peer' | 'report' | 'client';

export function evaluatorRolesForModel(
  model: PerformanceEvaluationModel,
): EvaluatorRole[] {
  switch (model) {
    case PerformanceEvaluationModel.DEGREE_180:
      return ['self', 'manager', 'peer'];
    case PerformanceEvaluationModel.DEGREE_270:
      return ['self', 'manager', 'peer', 'report'];
    case PerformanceEvaluationModel.DEGREE_360:
      return ['self', 'manager', 'peer', 'report', 'client'];
    default:
      return ['self', 'manager'];
  }
}

export function modelIncludesPeer(
  model: PerformanceEvaluationModel,
): boolean {
  return evaluatorRolesForModel(model).includes('peer');
}

export function modelIncludesReport(
  model: PerformanceEvaluationModel,
): boolean {
  return evaluatorRolesForModel(model).includes('report');
}

export function modelIncludesClient(
  model: PerformanceEvaluationModel,
): boolean {
  return evaluatorRolesForModel(model).includes('client');
}

export function isEvaluationRange(value: number): value is EvaluationRange {
  return value === 100 || value === 120;
}
