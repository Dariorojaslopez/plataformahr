import { BadRequestException } from '@nestjs/common';
import {
  GoalMetricDirection,
  GoalMetricType,
  GoalType,
  type GoalMetricType as GoalMetricTypeT,
  type GoalType as GoalTypeT,
} from '@prisma/client';
import { Prisma } from '@prisma/client';
import { WEIGHT_TOTAL_REQUIRED } from './goals.constants';

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

/** GoalCycle: startDate < endDate (strict). */
export function assertGoalCycleDates(startDate: Date, endDate: Date): void {
  const start = startOfUtcDay(startDate);
  const end = startOfUtcDay(endDate);
  if (start.getTime() >= end.getTime()) {
    throw new BadRequestException('startDate must be before endDate');
  }
}

export function emptyToNull(value?: string | null): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function decimalToString(
  value: Prisma.Decimal | null | undefined,
): string | null {
  if (value == null) return null;
  return value.toFixed();
}

export function parseOptionalWeight(
  value: number | null | undefined,
  field = 'weight',
): Prisma.Decimal | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value < 0 || value > 100) {
    throw new BadRequestException(`${field} must be between 0 and 100`);
  }
  return new Prisma.Decimal(value.toFixed(2));
}

export type WeightInput = { weight: number | string | null | undefined };

/** All null → OK. Any weight → all required and sum exactly 100. */
export function assertKeyResultWeights(items: WeightInput[]): void {
  if (items.length === 0) return;
  const values = items.map((i) =>
    i.weight == null || i.weight === '' ? null : Number(i.weight),
  );
  const anyWeighted = values.some((v) => v != null);
  if (!anyWeighted) return;
  if (values.some((v) => v == null)) {
    throw new BadRequestException(
      'When any key result has weight, all key results must have weight',
    );
  }
  for (const v of values) {
    if (v! < 0 || v! > 100) {
      throw new BadRequestException(
        'Key result weight must be between 0 and 100',
      );
    }
  }
  const sum = values.reduce((a, b) => a! + b!, 0)!;
  // Avoid float noise: compare at 2 decimals.
  if (Number(sum.toFixed(2)) !== WEIGHT_TOTAL_REQUIRED) {
    throw new BadRequestException(
      `Key result weights must sum to ${WEIGHT_TOTAL_REQUIRED}`,
    );
  }
}

export type MetricPayload = {
  metricType: GoalMetricTypeT;
  direction?: GoalMetricDirection | null;
  startValue?: number | null;
  targetValue?: number | null;
  targetBoolean?: boolean | null;
  unit?: string | null;
  currencyCode?: string | null;
};

export function assertMetricPayload(payload: MetricPayload): void {
  const type = payload.metricType;
  if (type === GoalMetricType.BOOLEAN) {
    if (payload.targetBoolean == null) {
      throw new BadRequestException(
        'BOOLEAN key results require targetBoolean',
      );
    }
    if (
      payload.targetValue != null ||
      payload.startValue != null ||
      payload.direction != null ||
      payload.currencyCode
    ) {
      throw new BadRequestException(
        'BOOLEAN key results must not set numeric targets, direction or currency',
      );
    }
    return;
  }

  if (payload.targetValue == null) {
    throw new BadRequestException(`${type} key results require targetValue`);
  }
  if (
    payload.direction !== GoalMetricDirection.INCREASE &&
    payload.direction !== GoalMetricDirection.DECREASE
  ) {
    throw new BadRequestException(`${type} key results require direction`);
  }
  if (payload.targetBoolean != null) {
    throw new BadRequestException(
      'Numeric key results must not set targetBoolean',
    );
  }
  if (type === GoalMetricType.CURRENCY) {
    const code = payload.currencyCode?.trim().toUpperCase();
    if (!code || !/^[A-Z]{3}$/.test(code)) {
      throw new BadRequestException(
        'CURRENCY key results require a 3-letter currencyCode (ISO 4217)',
      );
    }
  } else if (payload.currencyCode) {
    throw new BadRequestException(
      'currencyCode is only allowed for CURRENCY metrics',
    );
  }
}

export type ActivationGoalInput = {
  type: GoalTypeT;
  areaId: string | null;
  assignmentCount: number;
  keyResults: WeightInput[];
};

export function assertGoalActivationReady(input: ActivationGoalInput): void {
  if (input.keyResults.length < 1) {
    throw new BadRequestException('Goal requires at least one key result');
  }
  assertKeyResultWeights(input.keyResults);

  if (input.type === GoalType.INDIVIDUAL) {
    if (input.areaId != null) {
      throw new BadRequestException('INDIVIDUAL goals must not have areaId');
    }
    if (input.assignmentCount < 1) {
      throw new BadRequestException(
        'INDIVIDUAL goals require at least one assignment before activation',
      );
    }
  } else if (input.type === GoalType.AREA) {
    if (!input.areaId) {
      throw new BadRequestException('AREA goals require areaId');
    }
  } else if (input.type === GoalType.COMPANY) {
    if (input.areaId != null) {
      throw new BadRequestException('COMPANY goals must not have areaId');
    }
  }
}

export function assertGoalTypeShape(params: {
  type: GoalTypeT;
  areaId?: string | null;
}): void {
  if (params.type === GoalType.AREA && !params.areaId) {
    throw new BadRequestException('AREA goals require areaId');
  }
  if (
    (params.type === GoalType.INDIVIDUAL || params.type === GoalType.COMPANY) &&
    params.areaId
  ) {
    throw new BadRequestException(`${params.type} goals must not have areaId`);
  }
}
