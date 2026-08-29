import { BadRequestException } from '@nestjs/common';
import { PerformanceEvaluationModel, Prisma } from '@prisma/client';
import {
  evaluatorRolesForModel,
  isEvaluationRange,
  type EvaluationRange,
} from './evaluation-model';
import { WEIGHT_TOTAL_REQUIRED } from './performance.constants';

export type OptionalDateWindow = {
  startDate?: Date | null;
  endDate?: Date | null;
  startField: string;
  endField: string;
};

export type CycleDateInput = {
  startDate: Date;
  endDate: Date;
  evaluationStartDate?: Date | null;
  evaluationEndDate?: Date | null;
  goalDefinitionStartDate?: Date | null;
  goalDefinitionEndDate?: Date | null;
  managerEvaluationStartDate?: Date | null;
  managerEvaluationEndDate?: Date | null;
  calibrationStartDate?: Date | null;
  calibrationEndDate?: Date | null;
  closingStartDate?: Date | null;
  closingEndDate?: Date | null;
  followUps?: Array<{ startDate: Date; endDate: Date }>;
};

/**
 * Optional window: both dates or neither; when set, start <= end and inside cycle.
 */
export function assertOptionalDateWindow(
  window: OptionalDateWindow,
  cycleStart: Date,
  cycleEnd: Date,
): void {
  const hasStart = window.startDate != null;
  const hasEnd = window.endDate != null;
  if (hasStart !== hasEnd) {
    throw new BadRequestException(
      `${window.startField} and ${window.endField} must both be set or both omitted`,
    );
  }
  if (!hasStart || !hasEnd) {
    return;
  }

  const start = startOfUtcDay(window.startDate as Date);
  const end = startOfUtcDay(window.endDate as Date);
  if (start.getTime() > end.getTime()) {
    throw new BadRequestException(
      `${window.startField} must be on or before ${window.endField}`,
    );
  }
  if (start.getTime() < cycleStart.getTime() || end.getTime() > cycleEnd.getTime()) {
    throw new BadRequestException(
      `${window.startField} and ${window.endField} must fall within the cycle period`,
    );
  }
}

/**
 * Domain rules:
 * - startDate <= endDate
 * - optional windows: both null, or both set and inside [startDate, endDate]
 */
export function assertCycleDates(input: CycleDateInput): void {
  const start = startOfUtcDay(input.startDate);
  const end = startOfUtcDay(input.endDate);

  if (start.getTime() > end.getTime()) {
    throw new BadRequestException('startDate must be on or before endDate');
  }

  const windows: OptionalDateWindow[] = [
    {
      startDate: input.evaluationStartDate,
      endDate: input.evaluationEndDate,
      startField: 'evaluationStartDate',
      endField: 'evaluationEndDate',
    },
    {
      startDate: input.goalDefinitionStartDate,
      endDate: input.goalDefinitionEndDate,
      startField: 'goalDefinitionStartDate',
      endField: 'goalDefinitionEndDate',
    },
    {
      startDate: input.managerEvaluationStartDate,
      endDate: input.managerEvaluationEndDate,
      startField: 'managerEvaluationStartDate',
      endField: 'managerEvaluationEndDate',
    },
    {
      startDate: input.calibrationStartDate,
      endDate: input.calibrationEndDate,
      startField: 'calibrationStartDate',
      endField: 'calibrationEndDate',
    },
    {
      startDate: input.closingStartDate,
      endDate: input.closingEndDate,
      startField: 'closingStartDate',
      endField: 'closingEndDate',
    },
  ];
  for (const window of windows) {
    assertOptionalDateWindow(window, start, end);
  }

  for (const [index, followUp] of (input.followUps ?? []).entries()) {
    assertOptionalDateWindow(
      {
        startDate: followUp.startDate,
        endDate: followUp.endDate,
        startField: `followUps[${index}].startDate`,
        endField: `followUps[${index}].endDate`,
      },
      start,
      end,
    );
  }
}

export function startOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

export function parseDateOnly(value: string, field: string): Date {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new BadRequestException(`${field} must be YYYY-MM-DD`);
  }
  const date = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${field} is not a valid date`);
  }
  return date;
}

export function parseOptionalDateOnly(
  value: string | null | undefined,
  field: string,
): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === '') return null;
  return parseDateOnly(value, field);
}

export function sameUtcDay(a: Date, b: Date): boolean {
  return startOfUtcDay(a).getTime() === startOfUtcDay(b).getTime();
}

export type ResultCompositionConfig = {
  includeCompetencies: boolean;
  goalCycleId: string | null;
  competencyResultWeight: Prisma.Decimal | null;
  goalsResultWeight: Prisma.Decimal | null;
  organizationalGoalsWeight: Prisma.Decimal | null;
  individualGoalsWeight: Prisma.Decimal | null;
  evaluationRange: EvaluationRange;
  maxObjectives: number | null;
};

function toWeightNumber(value: Prisma.Decimal | null): number {
  return value == null ? 0 : Number(value.toString());
}

/**
 * Result composition:
 * - Competencies optional (includeCompetencies).
 * - Organizational + individual goal weights stored separately; goalsResultWeight = sum.
 * - Weights must not exceed evaluationRange (100 or 120). Need not sum to 100.
 */
export function resolveResultCompositionConfig(input: {
  includeCompetencies?: boolean;
  goalCycleId?: string | null;
  competencyResultWeight?: number | null;
  goalsResultWeight?: number | null;
  organizationalGoalsWeight?: number | null;
  individualGoalsWeight?: number | null;
  evaluationRange?: number | null;
  maxObjectives?: number | null;
}): ResultCompositionConfig {
  const includeCompetencies = input.includeCompetencies !== false;
  const evaluationRange = input.evaluationRange ?? 100;
  if (!isEvaluationRange(evaluationRange)) {
    throw new BadRequestException('evaluationRange must be 100 or 120');
  }

  if (input.maxObjectives != null && input.maxObjectives < 1) {
    throw new BadRequestException('maxObjectives must be >= 1');
  }

  const competencyResultWeight = includeCompetencies
    ? parseCompositionWeight(
        input.competencyResultWeight,
        'competencyResultWeight',
        evaluationRange,
      )
    : input.competencyResultWeight != null && input.competencyResultWeight !== 0
      ? (() => {
          throw new BadRequestException(
            'competencyResultWeight must be 0 when competencias are disabled',
          );
        })()
      : null;

  const organizationalGoalsWeight = parseCompositionWeight(
    input.organizationalGoalsWeight,
    'organizationalGoalsWeight',
    evaluationRange,
  );
  const individualFromSplit = parseCompositionWeight(
    input.individualGoalsWeight,
    'individualGoalsWeight',
    evaluationRange,
  );
  const individualFromLegacy = parseCompositionWeight(
    input.goalsResultWeight,
    'goalsResultWeight',
    evaluationRange,
  );
  const individualGoalsWeight =
    input.individualGoalsWeight !== undefined
      ? individualFromSplit
      : input.organizationalGoalsWeight !== undefined
        ? individualFromSplit
        : individualFromLegacy;

  const competencyN = includeCompetencies
    ? toWeightNumber(competencyResultWeight)
    : 0;
  const orgN = toWeightNumber(organizationalGoalsWeight);
  const individualN = toWeightNumber(individualGoalsWeight);
  const goalsN = orgN + individualN;
  const total = competencyN + goalsN;

  if (total - evaluationRange > 0.001) {
    throw new BadRequestException(
      `La ponderación de competencias y objetivos no puede superar ${evaluationRange}%`,
    );
  }

  const goalCycleId =
    input.goalCycleId === undefined || input.goalCycleId === null
      ? null
      : input.goalCycleId;

  if (goalsN <= 0) {
    if (goalCycleId != null) {
      throw new BadRequestException(
        'goalCycleId requiere ponderación de objetivos mayor a 0',
      );
    }
    if (!includeCompetencies) {
      throw new BadRequestException(
        'Debes activar competencias o indicar ponderación de objetivos',
      );
    }
    return {
      includeCompetencies: true,
      goalCycleId: null,
      competencyResultWeight: null,
      goalsResultWeight: null,
      organizationalGoalsWeight: null,
      individualGoalsWeight: null,
      evaluationRange,
      maxObjectives: input.maxObjectives ?? null,
    };
  }

  if (goalCycleId == null) {
    throw new BadRequestException(
      'goalCycleId is required when goal weights are set',
    );
  }

  return {
    includeCompetencies,
    goalCycleId,
    competencyResultWeight: includeCompetencies
      ? (competencyResultWeight ?? new Prisma.Decimal(0))
      : new Prisma.Decimal(0),
    goalsResultWeight: new Prisma.Decimal(goalsN.toFixed(2)),
    organizationalGoalsWeight: organizationalGoalsWeight ?? new Prisma.Decimal(0),
    individualGoalsWeight: individualGoalsWeight ?? new Prisma.Decimal(0),
    evaluationRange,
    maxObjectives: input.maxObjectives ?? null,
  };
}

/**
 * Legacy wrapper: competency-only vs integrated 09D (sum 100).
 * Prefer resolveResultCompositionConfig for new fields.
 */
export function resolveGoalsCompositionConfig(input: {
  goalCycleId: string | null | undefined;
  competencyResultWeight: number | null | undefined;
  goalsResultWeight: number | null | undefined;
  includeCompetencies?: boolean;
  organizationalGoalsWeight?: number | null;
  individualGoalsWeight?: number | null;
  evaluationRange?: number | null;
  maxObjectives?: number | null;
}): ResultCompositionConfig {
  return resolveResultCompositionConfig(input);
}

export function emptyToNull(value?: string | null): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Weight semantics:
 * - All null → unweighted evaluation (OK).
 * - Any non-null → all must be non-null and sum exactly 100.
 */
export function assertActivationWeights(
  weights: Array<Prisma.Decimal | number | string | null | undefined>,
): void {
  const normalized = weights.map((w) => {
    if (w == null) return null;
    return new Prisma.Decimal(w);
  });

  const anyWeighted = normalized.some((w) => w != null);
  if (!anyWeighted) {
    return;
  }

  if (normalized.some((w) => w == null)) {
    throw new BadRequestException(
      'Si alguna competencia usa ponderación, todas deben tener weight',
    );
  }

  let total = new Prisma.Decimal(0);
  for (const w of normalized) {
    total = total.plus(w as Prisma.Decimal);
  }

  if (!total.equals(WEIGHT_TOTAL_REQUIRED)) {
    throw new BadRequestException('Las ponderaciones deben sumar 100%');
  }
}

export function sumWeights(
  weights: Array<Prisma.Decimal | number | string | null | undefined>,
): number | null {
  const values = weights.filter((w) => w != null);
  if (values.length === 0) return null;
  let total = new Prisma.Decimal(0);
  for (const w of values) {
    total = total.plus(new Prisma.Decimal(w));
  }
  return total.toNumber();
}

export function parseWeight(
  value: number | string | null | undefined,
): Prisma.Decimal | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const decimal = new Prisma.Decimal(value);
  if (decimal.isNeg()) {
    throw new BadRequestException('weight must be >= 0');
  }
  return decimal;
}

/** Evaluator weights — enabled groups for the model must sum to 100. */
export function assertEvaluatorWeights(params: {
  evaluationModel?: PerformanceEvaluationModel;
  selfEvaluationWeight: Prisma.Decimal | number | string;
  managerEvaluationWeight: Prisma.Decimal | number | string;
  peerEvaluationWeight?: Prisma.Decimal | number | string | null;
  reportEvaluationWeight?: Prisma.Decimal | number | string | null;
  clientEvaluationWeight?: Prisma.Decimal | number | string | null;
}): void {
  const model = params.evaluationModel ?? PerformanceEvaluationModel.DEGREE_90;
  const roles = evaluatorRolesForModel(model);
  const byRole: Record<EvaluatorRoleFromWeights, Prisma.Decimal | null> = {
    self: new Prisma.Decimal(params.selfEvaluationWeight),
    manager: new Prisma.Decimal(params.managerEvaluationWeight),
    peer: decimalOrNull(params.peerEvaluationWeight),
    report: decimalOrNull(params.reportEvaluationWeight),
    client: decimalOrNull(params.clientEvaluationWeight),
  };

  for (const role of ['self', 'manager', 'peer', 'report', 'client'] as const) {
    const enabled = roles.includes(role);
    const value = byRole[role];
    if (!enabled) {
      if (value != null && !value.equals(0)) {
        throw new BadRequestException(
          `${role}EvaluationWeight is not allowed for this evaluation model`,
        );
      }
      continue;
    }
    const weight = value ?? new Prisma.Decimal(0);
    if (weight.isNeg()) {
      throw new BadRequestException('Evaluator weights must be >= 0');
    }
    if (weight.greaterThan(100)) {
      throw new BadRequestException('Evaluator weights must be <= 100');
    }
    byRole[role] = weight;
  }

  const total = roles.reduce(
    (sum, role) => sum.plus(byRole[role] ?? 0),
    new Prisma.Decimal(0),
  );
  if (!total.equals(100)) {
    throw new BadRequestException(
      'Las ponderaciones de evaluadores habilitados deben sumar 100',
    );
  }
}

function decimalOrNull(
  value: Prisma.Decimal | number | string | null | undefined,
): Prisma.Decimal | null {
  if (value == null) return null;
  return new Prisma.Decimal(value);
}

type EvaluatorRoleFromWeights = 'self' | 'manager' | 'peer' | 'report' | 'client';

export function parseEvaluatorWeight(
  value: number | string | undefined,
  field: string,
): Prisma.Decimal | undefined {
  if (value === undefined) return undefined;
  const decimal = new Prisma.Decimal(value);
  if (decimal.isNeg()) {
    throw new BadRequestException(`${field} must be >= 0`);
  }
  if (decimal.greaterThan(100)) {
    throw new BadRequestException(`${field} must be <= 100`);
  }
  return decimal;
}

export function parseCompositionWeight(
  value: number | string | null | undefined,
  field: string,
  max: number,
): Prisma.Decimal | null {
  if (value === undefined || value === null) return null;
  const decimal = new Prisma.Decimal(value);
  if (decimal.isNeg()) {
    throw new BadRequestException(`${field} must be >= 0`);
  }
  if (decimal.greaterThan(max)) {
    throw new BadRequestException(`${field} must be <= ${max}`);
  }
  return decimal;
}

export function parseOptionalEvaluatorWeight(
  value: number | string | null | undefined,
  field: string,
): Prisma.Decimal | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return parseEvaluatorWeight(value, field) ?? null;
}

export function decimalToString(
  value: Prisma.Decimal | null | undefined,
): string | null {
  if (value == null) return null;
  return value.toFixed(2);
}
