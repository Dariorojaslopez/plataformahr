import { BadRequestException } from '@nestjs/common';
import {
  CompetencyScaleFormat,
  CompetencyScaleKind,
} from '@prisma/client';

export const QUALITATIVE_SCALE_FORMATS: CompetencyScaleFormat[] = [
  CompetencyScaleFormat.NUMERIC,
  CompetencyScaleFormat.DESCRIPTIVE,
  CompetencyScaleFormat.LIKERT,
];

export const QUANTITATIVE_SCALE_FORMATS: CompetencyScaleFormat[] = [
  CompetencyScaleFormat.PERCENTAGE,
  CompetencyScaleFormat.CURRENCY,
  CompetencyScaleFormat.NUMERIC,
];

export const MAX_DESCRIPTIVE_LEVELS = 5;
export const MIN_SCALE_STEPS = 2;
export const MAX_INTEGER_RANGE = 10;

export const LIKERT_ICONS = ['STARS', 'HEARTS', 'THUMBS', 'FACES'] as const;
export type LikertIcon = (typeof LIKERT_ICONS)[number];

export const CURRENCY_CODES = [
  'COP',
  'USD',
  'EUR',
  'MXN',
  'CLP',
  'PEN',
  'ARS',
  'BRL',
] as const;

export type ScaleLevelSeed = {
  value: number;
  label: string;
  order: number;
};

export type NormalizedScaleConfig = {
  format: CompetencyScaleFormat;
  minValue: number | null;
  maxValue: number | null;
  likertIcon: string | null;
  currencyCode: string | null;
  decimalPlaces: number | null;
  levels: ScaleLevelSeed[];
};

const KIND_FORMAT_MESSAGE =
  'El formato de la escala no corresponde al tipo cualitativa o cuantitativa.';

export function formatsForKind(
  kind: CompetencyScaleKind,
): CompetencyScaleFormat[] {
  return kind === CompetencyScaleKind.QUANTITATIVE
    ? QUANTITATIVE_SCALE_FORMATS
    : QUALITATIVE_SCALE_FORMATS;
}

export function assertKindAndFormat(
  kind: CompetencyScaleKind,
  format: CompetencyScaleFormat,
): void {
  if (!formatsForKind(kind).includes(format)) {
    throw new BadRequestException(KIND_FORMAT_MESSAGE);
  }
}

function requireNumber(
  value: number | undefined,
  label: string,
): number {
  if (value == null || !Number.isFinite(value)) {
    throw new BadRequestException(`${label} es obligatorio.`);
  }
  return value;
}

function compactDescriptiveLabels(labels: string[] | undefined): string[] {
  return (labels ?? [])
    .map((label) => label.trim())
    .filter((label) => label.length > 0)
    .slice(0, MAX_DESCRIPTIVE_LEVELS);
}

export function normalizeScaleConfig(input: {
  kind: CompetencyScaleKind;
  format?: CompetencyScaleFormat;
  minValue?: number;
  maxValue?: number;
  likertIcon?: string | null;
  currencyCode?: string | null;
  decimalPlaces?: number | null;
  descriptiveLabels?: string[];
}): NormalizedScaleConfig {
  const format = input.format ?? CompetencyScaleFormat.NUMERIC;
  assertKindAndFormat(input.kind, format);

  if (input.kind === CompetencyScaleKind.QUALITATIVE) {
    if (format === CompetencyScaleFormat.DESCRIPTIVE) {
      const labels = compactDescriptiveLabels(input.descriptiveLabels);
      if (labels.length < MIN_SCALE_STEPS) {
        throw new BadRequestException(
          'La escala descriptiva requiere al menos dos textos de nivel.',
        );
      }
      return {
        format,
        minValue: 1,
        maxValue: labels.length,
        likertIcon: null,
        currencyCode: null,
        decimalPlaces: null,
        levels: labels.map((label, index) => ({
          value: index + 1,
          label,
          order: index + 1,
        })),
      };
    }

    const minValue = Math.trunc(requireNumber(input.minValue, 'El valor mínimo'));
    const maxValue = Math.trunc(requireNumber(input.maxValue, 'El valor máximo'));
    if (minValue < 0 || maxValue < 0) {
      throw new BadRequestException('Los valores mínimo y máximo deben ser >= 0.');
    }
    const steps = maxValue - minValue + 1;
    if (steps < MIN_SCALE_STEPS) {
      throw new BadRequestException(
        'El valor máximo debe ser mayor que el mínimo.',
      );
    }
    if (steps > MAX_INTEGER_RANGE) {
      throw new BadRequestException(
        `La escala numérica admite como máximo ${MAX_INTEGER_RANGE} valores.`,
      );
    }
    let likertIcon: string | null = null;
    if (format === CompetencyScaleFormat.LIKERT) {
      const icon = input.likertIcon?.trim() || 'STARS';
      if (!LIKERT_ICONS.includes(icon as LikertIcon)) {
        throw new BadRequestException('Selecciona un ícono de calificación.');
      }
      likertIcon = icon;
    }
    const levels: ScaleLevelSeed[] = [];
    for (let value = minValue; value <= maxValue; value += 1) {
      levels.push({
        value,
        label: String(value),
        order: value - minValue + 1,
      });
    }
    return {
      format,
      minValue,
      maxValue,
      likertIcon,
      currencyCode: null,
      decimalPlaces: null,
      levels,
    };
  }

  if (format === CompetencyScaleFormat.PERCENTAGE) {
    const minValue = requireNumber(input.minValue, 'El valor mínimo');
    const maxValue = requireNumber(input.maxValue, 'El valor máximo');
    if (maxValue <= minValue) {
      throw new BadRequestException(
        'El valor máximo debe ser mayor que el mínimo.',
      );
    }
    return {
      format,
      minValue,
      maxValue,
      likertIcon: null,
      currencyCode: null,
      decimalPlaces: null,
      levels: [],
    };
  }

  if (format === CompetencyScaleFormat.CURRENCY) {
    const code = (input.currencyCode ?? 'COP').trim().toUpperCase();
    if (!CURRENCY_CODES.includes(code as (typeof CURRENCY_CODES)[number])) {
      throw new BadRequestException('Selecciona una moneda válida.');
    }
    return {
      format,
      minValue: null,
      maxValue: null,
      likertIcon: null,
      currencyCode: code,
      decimalPlaces: 2,
      levels: [],
    };
  }

  const decimalPlaces = input.decimalPlaces ?? 2;
  if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 2) {
    throw new BadRequestException(
      'El formato numérico admite como máximo 2 decimales.',
    );
  }
  return {
    format,
    minValue: null,
    maxValue: null,
    likertIcon: null,
    currencyCode: null,
    decimalPlaces,
    levels: [],
  };
}

export function hasScaleLayoutInput(input: {
  format?: CompetencyScaleFormat;
  minValue?: number;
  maxValue?: number;
  likertIcon?: string | null;
  currencyCode?: string | null;
  decimalPlaces?: number | null;
  descriptiveLabels?: string[];
}): boolean {
  return (
    input.format != null ||
    input.minValue != null ||
    input.maxValue != null ||
    Boolean(input.likertIcon) ||
    Boolean(input.currencyCode) ||
    input.decimalPlaces != null ||
    (input.descriptiveLabels != null && input.descriptiveLabels.length > 0)
  );
}

export function descriptiveLevelPercent(levelCount: number): number {
  if (levelCount <= 0) return 0;
  return Math.round(100 / levelCount);
}
