import { BadRequestException } from '@nestjs/common';
import { CompetencyScaleKind } from '@prisma/client';

export const COMPETENCY_RATING_SCALE_KIND = CompetencyScaleKind.QUALITATIVE;

export const COMPETENCY_QUANTITATIVE_SCALE_MESSAGE =
  'Las competencias solo pueden calificarse con una escala cualitativa.';

export function assertQualitativeCompetencyScale(
  kind: CompetencyScaleKind,
): void {
  if (kind !== COMPETENCY_RATING_SCALE_KIND) {
    throw new BadRequestException(COMPETENCY_QUANTITATIVE_SCALE_MESSAGE);
  }
}
