import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { WEIGHT_TOTAL_REQUIRED } from './performance.constants';

export type CycleDateInput = {
  startDate: Date;
  endDate: Date;
  evaluationStartDate?: Date | null;
  evaluationEndDate?: Date | null;
};

/**
 * Domain rules (08A):
 * - startDate <= endDate
 * - evaluation dates: both null, or both set
 * - when set: evaluationStart <= evaluationEnd
 * - evaluation window must fall within [startDate, endDate]
 */
export function assertCycleDates(input: CycleDateInput): void {
  const start = startOfUtcDay(input.startDate);
  const end = startOfUtcDay(input.endDate);

  if (start.getTime() > end.getTime()) {
    throw new BadRequestException('startDate must be on or before endDate');
  }

  const evalStartRaw = input.evaluationStartDate;
  const evalEndRaw = input.evaluationEndDate;
  const hasStart = evalStartRaw != null;
  const hasEnd = evalEndRaw != null;

  if (hasStart !== hasEnd) {
    throw new BadRequestException(
      'evaluationStartDate and evaluationEndDate must both be set or both omitted',
    );
  }

  if (!hasStart || !hasEnd) {
    return;
  }

  const evalStart = startOfUtcDay(evalStartRaw);
  const evalEnd = startOfUtcDay(evalEndRaw);

  if (evalStart.getTime() > evalEnd.getTime()) {
    throw new BadRequestException(
      'evaluationStartDate must be on or before evaluationEndDate',
    );
  }
  if (
    evalStart.getTime() < start.getTime() ||
    evalEnd.getTime() > end.getTime()
  ) {
    throw new BadRequestException(
      'Evaluation dates must fall within the cycle period',
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

/**
 * Resolve optional Goals composition on a PerformanceCycle (09D).
 * - goalCycleId null → competency/goals weights must be null
 * - goalCycleId set → both weights required and sum to 100
 */
export function resolveGoalsCompositionConfig(input: {
  goalCycleId: string | null | undefined;
  competencyResultWeight: number | null | undefined;
  goalsResultWeight: number | null | undefined;
}): {
  goalCycleId: string | null;
  competencyResultWeight: Prisma.Decimal | null;
  goalsResultWeight: Prisma.Decimal | null;
} {
  const goalCycleId =
    input.goalCycleId === undefined || input.goalCycleId === null
      ? null
      : input.goalCycleId;

  if (goalCycleId == null) {
    if (
      input.competencyResultWeight != null ||
      input.goalsResultWeight != null
    ) {
      throw new BadRequestException(
        'competencyResultWeight and goalsResultWeight require goalCycleId',
      );
    }
    return {
      goalCycleId: null,
      competencyResultWeight: null,
      goalsResultWeight: null,
    };
  }

  if (input.competencyResultWeight == null || input.goalsResultWeight == null) {
    throw new BadRequestException(
      'competencyResultWeight and goalsResultWeight are required when goalCycleId is set',
    );
  }

  const competencyResultWeight = parseEvaluatorWeight(
    input.competencyResultWeight,
    'competencyResultWeight',
  )!;
  const goalsResultWeight = parseEvaluatorWeight(
    input.goalsResultWeight,
    'goalsResultWeight',
  )!;
  const sum =
    Number(competencyResultWeight.toString()) +
    Number(goalsResultWeight.toString());
  if (Math.round(sum * 100) / 100 !== WEIGHT_TOTAL_REQUIRED) {
    throw new BadRequestException(
      'El peso de competencias y el de objetivos deben sumar 100',
    );
  }

  return { goalCycleId, competencyResultWeight, goalsResultWeight };
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

/** Evaluator weights (SELF/MANAGER) — required, 0–100, sum must be 100. */
export function assertEvaluatorWeights(params: {
  selfEvaluationWeight: Prisma.Decimal | number | string;
  managerEvaluationWeight: Prisma.Decimal | number | string;
}): void {
  const selfW = new Prisma.Decimal(params.selfEvaluationWeight);
  const managerW = new Prisma.Decimal(params.managerEvaluationWeight);
  if (selfW.isNeg() || managerW.isNeg()) {
    throw new BadRequestException('Evaluator weights must be >= 0');
  }
  if (selfW.greaterThan(100) || managerW.greaterThan(100)) {
    throw new BadRequestException('Evaluator weights must be <= 100');
  }
  if (!selfW.plus(managerW).equals(100)) {
    throw new BadRequestException(
      'selfEvaluationWeight + managerEvaluationWeight must equal 100',
    );
  }
}

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

export function decimalToString(
  value: Prisma.Decimal | null | undefined,
): string | null {
  if (value == null) return null;
  return value.toFixed(2);
}
