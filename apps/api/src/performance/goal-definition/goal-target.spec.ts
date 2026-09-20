import { BadRequestException } from '@nestjs/common';
import { CompetencyScaleFormat, CompetencyScaleKind } from '@prisma/client';
import { resolveGoalTarget } from './goal-target';

const qualitative = {
  kind: CompetencyScaleKind.QUALITATIVE,
  format: CompetencyScaleFormat.DESCRIPTIVE,
  minValue: 1,
  maxValue: 3,
  levels: [{ id: 'lvl-1' }, { id: 'lvl-2' }],
};

const currency = {
  kind: CompetencyScaleKind.QUANTITATIVE,
  format: CompetencyScaleFormat.CURRENCY,
  minValue: null,
  maxValue: null,
  levels: [],
};

const percentage = {
  kind: CompetencyScaleKind.QUANTITATIVE,
  format: CompetencyScaleFormat.PERCENTAGE,
  minValue: 0,
  maxValue: 100,
  levels: [],
};

describe('resolveGoalTarget', () => {
  it('requires a scale level for qualitative individual goals', () => {
    expect(() =>
      resolveGoalTarget(qualitative, {}, { required: true }),
    ).toThrow(BadRequestException);
    expect(
      resolveGoalTarget(
        qualitative,
        { targetScaleLevelId: 'lvl-2' },
        { required: true },
      ),
    ).toEqual({ targetValue: null, targetScaleLevelId: 'lvl-2' });
  });

  it('rejects a level that does not belong to the scale', () => {
    expect(() =>
      resolveGoalTarget(
        qualitative,
        { targetScaleLevelId: 'other' },
        { required: true },
      ),
    ).toThrow(BadRequestException);
  });

  it('stores a currency amount and ignores leftover level ids', () => {
    expect(
      resolveGoalTarget(
        currency,
        { targetValue: 50_000_000, targetScaleLevelId: 'lvl-1' },
        { required: true },
      ),
    ).toEqual({ targetValue: 50_000_000, targetScaleLevelId: null });
  });

  it('enforces percentage min and max', () => {
    expect(() =>
      resolveGoalTarget(percentage, { targetValue: 140 }, { required: true }),
    ).toThrow(BadRequestException);
    expect(
      resolveGoalTarget(percentage, { targetValue: 80 }, { required: true }),
    ).toEqual({ targetValue: 80, targetScaleLevelId: null });
  });

  it('allows empty target when it is not required', () => {
    expect(resolveGoalTarget(currency, {}, { required: false })).toEqual({
      targetValue: null,
      targetScaleLevelId: null,
    });
  });
});
