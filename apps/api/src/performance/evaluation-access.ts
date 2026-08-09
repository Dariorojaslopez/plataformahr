import {
  PerformanceEvaluationStatus,
  PerformanceEvaluationType,
  PerformanceParticipantStatus,
} from '@prisma/client';

export const NO_DIRECT_MANAGER = 'NO_DIRECT_MANAGER' as const;

export type SnapshotCompetencyInput = {
  sourceCompetencyId: string;
  sourceScaleId: string;
  name: string;
  code: string | null;
  description: string | null;
  scaleName: string;
  /** Prefer string/number; Prisma Decimal accepted via toString. */
  weight: string | number | { toString(): string } | null;
  required: boolean;
  order: number;
  levels: Array<{
    sourceScaleLevelId: string;
    value: number;
    label: string;
    description: string | null;
    order: number;
  }>;
};

function weightFingerprint(
  weight: SnapshotCompetencyInput['weight'],
): string | null {
  if (weight == null) return null;
  if (typeof weight === 'string' || typeof weight === 'number') {
    return String(weight);
  }
  return weight.toString();
}

/** Comparable fingerprint for SELF vs MANAGER snapshot equality tests. */
export function snapshotFingerprint(
  competencies: SnapshotCompetencyInput[],
): string {
  const normalized = competencies
    .map((c) => ({
      sourceCompetencyId: c.sourceCompetencyId,
      sourceScaleId: c.sourceScaleId,
      name: c.name,
      code: c.code,
      description: c.description,
      scaleName: c.scaleName,
      weight: weightFingerprint(c.weight),
      required: c.required,
      order: c.order,
      levels: c.levels
        .map((l) => ({
          sourceScaleLevelId: l.sourceScaleLevelId,
          value: l.value,
          label: l.label,
          description: l.description,
          order: l.order,
        }))
        .sort((a, b) => a.order - b.order),
    }))
    .sort((a, b) => a.order - b.order);
  return JSON.stringify(normalized);
}

export function canExcludeParticipant(params: {
  participantStatus: PerformanceParticipantStatus;
  evaluationStatuses: PerformanceEvaluationStatus[];
}): boolean {
  if (params.participantStatus === PerformanceParticipantStatus.EXCLUDED) {
    return false;
  }
  return !params.evaluationStatuses.includes(
    PerformanceEvaluationStatus.SUBMITTED,
  );
}

export function canAccessEvaluation(params: {
  hasManagePermission: boolean;
  actorEmployeeId: string | null;
  evaluation: {
    employeeId: string;
    evaluatorEmployeeId: string | null;
    type: PerformanceEvaluationType;
  };
}): boolean {
  if (params.hasManagePermission) return true;
  if (!params.actorEmployeeId) return false;

  const { evaluation, actorEmployeeId } = params;
  if (evaluation.type === PerformanceEvaluationType.SELF) {
    return evaluation.employeeId === actorEmployeeId;
  }
  if (evaluation.type === PerformanceEvaluationType.MANAGER) {
    return evaluation.evaluatorEmployeeId === actorEmployeeId;
  }
  return false;
}

/**
 * Respond requires respond permission AND being the frozen evaluator.
 * Manage alone never impersonates an evaluator.
 */
export function canRespondToEvaluation(params: {
  hasRespondPermission: boolean;
  actorEmployeeId: string | null;
  evaluatorEmployeeId: string | null;
}): boolean {
  if (!params.hasRespondPermission) return false;
  if (!params.actorEmployeeId || !params.evaluatorEmployeeId) return false;
  return params.actorEmployeeId === params.evaluatorEmployeeId;
}

export function resolveEvaluatorForType(params: {
  type: PerformanceEvaluationType;
  employeeId: string;
  managerEmployeeId: string | null;
}): string | null {
  if (params.type === PerformanceEvaluationType.SELF) {
    return params.employeeId;
  }
  return params.managerEmployeeId;
}
