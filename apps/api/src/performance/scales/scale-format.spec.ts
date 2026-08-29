import { BadRequestException } from '@nestjs/common';
import {
  CompetencyScaleFormat,
  CompetencyScaleKind,
} from '@prisma/client';
import {
  descriptiveLevelPercent,
  MAX_DESCRIPTIVE_LEVELS,
  normalizeScaleConfig,
} from './scale-format';

describe('normalizeScaleConfig', () => {
  it('builds 1–5 numeric qualitative levels', () => {
    const config = normalizeScaleConfig({
      kind: CompetencyScaleKind.QUALITATIVE,
      format: CompetencyScaleFormat.NUMERIC,
      minValue: 1,
      maxValue: 5,
    });
    expect(config.levels.map((level) => level.value)).toEqual([1, 2, 3, 4, 5]);
    expect(config.likertIcon).toBeNull();
  });

  it('stores descriptive labels with equal percentage steps', () => {
    const config = normalizeScaleConfig({
      kind: CompetencyScaleKind.QUALITATIVE,
      format: CompetencyScaleFormat.DESCRIPTIVE,
      descriptiveLabels: ['Bajo', 'Medio', 'Alto', '', ''],
    });
    expect(config.levels.map((level) => level.label)).toEqual([
      'Bajo',
      'Medio',
      'Alto',
    ]);
    expect(descriptiveLevelPercent(config.levels.length)).toBe(33);
    expect(config.maxValue).toBe(3);
  });

  it('requires a Likert icon and min/max', () => {
    const config = normalizeScaleConfig({
      kind: CompetencyScaleKind.QUALITATIVE,
      format: CompetencyScaleFormat.LIKERT,
      minValue: 1,
      maxValue: 5,
      likertIcon: 'STARS',
    });
    expect(config.likertIcon).toBe('STARS');
    expect(config.levels).toHaveLength(5);
  });

  it('rejects a qualitative percentage format', () => {
    expect(() =>
      normalizeScaleConfig({
        kind: CompetencyScaleKind.QUALITATIVE,
        format: CompetencyScaleFormat.PERCENTAGE,
        minValue: 1,
        maxValue: 100,
      }),
    ).toThrow(BadRequestException);
  });

  it('keeps quantitative percentage as a range without discrete levels', () => {
    const config = normalizeScaleConfig({
      kind: CompetencyScaleKind.QUANTITATIVE,
      format: CompetencyScaleFormat.PERCENTAGE,
      minValue: 1,
      maxValue: 120,
    });
    expect(config.levels).toEqual([]);
    expect(config.minValue).toBe(1);
    expect(config.maxValue).toBe(120);
  });

  it('stores currency code with 2 decimal places', () => {
    const config = normalizeScaleConfig({
      kind: CompetencyScaleKind.QUANTITATIVE,
      format: CompetencyScaleFormat.CURRENCY,
      currencyCode: 'usd',
    });
    expect(config.currencyCode).toBe('USD');
    expect(config.decimalPlaces).toBe(2);
    expect(config.levels).toEqual([]);
  });

  it('caps quantitative numeric decimals at 2', () => {
    expect(() =>
      normalizeScaleConfig({
        kind: CompetencyScaleKind.QUANTITATIVE,
        format: CompetencyScaleFormat.NUMERIC,
        decimalPlaces: 3,
      }),
    ).toThrow(BadRequestException);
  });

  it(`allows at most ${MAX_DESCRIPTIVE_LEVELS} descriptive labels`, () => {
    const config = normalizeScaleConfig({
      kind: CompetencyScaleKind.QUALITATIVE,
      format: CompetencyScaleFormat.DESCRIPTIVE,
      descriptiveLabels: ['a', 'b', 'c', 'd', 'e', 'f'],
    });
    expect(config.levels).toHaveLength(MAX_DESCRIPTIVE_LEVELS);
  });
});
