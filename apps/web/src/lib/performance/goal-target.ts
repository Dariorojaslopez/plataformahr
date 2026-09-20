import type {
  CompetencyScaleFormat,
  GoalDefinitionScale,
} from "@/types/performance";

export function findGoalDefinitionScale(
  scales: GoalDefinitionScale[],
  scaleId: string,
): GoalDefinitionScale | undefined {
  return scales.find((scale) => scale.id === scaleId);
}

export function isQualitativeGoalScale(
  scale: GoalDefinitionScale | undefined,
): boolean {
  return scale?.kind !== "QUANTITATIVE";
}

export function parseGoalTargetValue(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export function hasIndividualGoalTarget(
  scale: GoalDefinitionScale | undefined,
  targetValue: string,
  targetScaleLevelId: string,
): boolean {
  if (!scale) return false;
  if (isQualitativeGoalScale(scale)) {
    return Boolean(targetScaleLevelId);
  }
  return parseGoalTargetValue(targetValue) != null;
}

export function goalTargetPrefix(
  scale: GoalDefinitionScale | undefined,
): string | null {
  if (!scale || scale.kind !== "QUANTITATIVE") return null;
  if (scale.format === "CURRENCY") return scale.currencyCode ?? "COP";
  return null;
}

export function goalTargetSuffix(
  scale: GoalDefinitionScale | undefined,
): string | null {
  if (!scale || scale.kind !== "QUANTITATIVE") return null;
  if (scale.format === "PERCENTAGE") return "%";
  return null;
}

export function goalTargetStep(
  scale: GoalDefinitionScale | undefined,
): string {
  if (scale?.decimalPlaces === 0) return "1";
  if (scale?.decimalPlaces === 1) return "0.1";
  return "0.01";
}

export function goalTargetBounds(scale: GoalDefinitionScale | undefined): {
  min?: number;
  max?: number;
} {
  if (!scale) return {};
  const min = scale.minValue != null ? Number(scale.minValue) : undefined;
  const max = scale.maxValue != null ? Number(scale.maxValue) : undefined;
  return {
    min: min != null && Number.isFinite(min) ? min : undefined,
    max: max != null && Number.isFinite(max) ? max : undefined,
  };
}

export function goalTargetHint(
  scale: GoalDefinitionScale | undefined,
): string {
  if (!scale) {
    return "Selecciona una escala para definir la meta.";
  }
  if (scale.kind !== "QUANTITATIVE") {
    return "Nivel esperado de la escala.";
  }
  const { min, max } = goalTargetBounds(scale);
  if (scale.format === "CURRENCY") {
    return `Monto objetivo en ${scale.currencyCode ?? "COP"}.`;
  }
  if (scale.format === "PERCENTAGE") {
    if (min != null && max != null) {
      return `Porcentaje objetivo entre ${min} y ${max}.`;
    }
    return "Porcentaje objetivo.";
  }
  if (min != null && max != null) {
    return `Valor objetivo entre ${min} y ${max}.`;
  }
  return "Valor numérico objetivo.";
}

export function formatGoalTarget(input: {
  targetValue: string | null;
  targetScaleLevel: { label: string } | null;
  scale?: { format?: CompetencyScaleFormat; currencyCode?: string | null } | null;
}): string | null {
  if (input.targetScaleLevel?.label) {
    return input.targetScaleLevel.label;
  }
  if (input.targetValue == null || input.targetValue === "") {
    return null;
  }
  const value = Number(input.targetValue);
  if (!Number.isFinite(value)) return input.targetValue;
  if (input.scale?.format === "CURRENCY") {
    return `${input.scale.currencyCode ?? "COP"} ${value.toLocaleString("es-CO")}`;
  }
  if (input.scale?.format === "PERCENTAGE") {
    return `${value}%`;
  }
  return value.toLocaleString("es-CO");
}
