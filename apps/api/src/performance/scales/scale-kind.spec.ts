import { BadRequestException } from '@nestjs/common';
import { CompetencyScaleKind } from '@prisma/client';
import {
  assertQualitativeCompetencyScale,
  COMPETENCY_QUANTITATIVE_SCALE_MESSAGE,
} from './scale-kind';

describe('assertQualitativeCompetencyScale', () => {
  it('allows qualitative scales', () => {
    expect(() =>
      assertQualitativeCompetencyScale(CompetencyScaleKind.QUALITATIVE),
    ).not.toThrow();
  });

  it('rejects quantitative scales', () => {
    expect(() =>
      assertQualitativeCompetencyScale(CompetencyScaleKind.QUANTITATIVE),
    ).toThrow(BadRequestException);
    try {
      assertQualitativeCompetencyScale(CompetencyScaleKind.QUANTITATIVE);
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).message).toBe(
        COMPETENCY_QUANTITATIVE_SCALE_MESSAGE,
      );
    }
  });
});
