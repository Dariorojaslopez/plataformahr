import { BadRequestException } from '@nestjs/common';
import { CompetencyScaleFormat, CompetencyScaleKind } from '@prisma/client';

export type GoalTargetInput = {
  targetValue?: number | null;
  targetScaleLevelId?: string | null;
};

export type ScaleForGoalTarget = {
  kind: CompetencyScaleKind;
  format: CompetencyScaleFormat;
  minValue: number | null;
  maxValue: number | null;
  levels: Array<{ id: string }>;
};

export type ResolvedGoalTarget = {
  targetValue: number | null;
  targetScaleLevelId: string | null;
};

export function resolveGoalTarget(
  scale: ScaleForGoalTarget,
  input: GoalTargetInput,
  options: { required: boolean },
): ResolvedGoalTarget {
  if (scale.kind === CompetencyScaleKind.QUALITATIVE) {
    const levelId = emptyToNull(input.targetScaleLevelId);
    if (!levelId) {
      if (options.required) {
        throw new BadRequestException(
          'Cada objetivo individual necesita una meta según la escala.',
        );
      }
      return { targetValue: null, targetScaleLevelId: null };
    }
    if (!scale.levels.some((level) => level.id === levelId)) {
      throw new BadRequestException(
        'La meta debe ser un nivel de la escala seleccionada.',
      );
    }
    return { targetValue: null, targetScaleLevelId: levelId };
  }

  const value = input.targetValue;
  if (value == null || !Number.isFinite(value)) {
    if (options.required) {
      throw new BadRequestException(
        'Cada objetivo individual necesita una meta numérica.',
      );
    }
    return { targetValue: null, targetScaleLevelId: null };
  }

  if (scale.minValue != null && value < scale.minValue) {
    throw new BadRequestException(
      `La meta debe ser mayor o igual a ${scale.minValue}.`,
    );
  }
  if (scale.maxValue != null && value > scale.maxValue) {
    throw new BadRequestException(
      `La meta debe ser menor o igual a ${scale.maxValue}.`,
    );
  }
  if (scale.format === CompetencyScaleFormat.PERCENTAGE && value < 0) {
    throw new BadRequestException('La meta en porcentaje no puede ser negativa.');
  }

  return { targetValue: value, targetScaleLevelId: null };
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
