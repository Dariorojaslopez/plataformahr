import type {
  CompetencyScale,
  CompetencyScaleFormat,
  CompetencyScaleKind,
  CreateCompetencyScaleInput,
  OrganizationEntityStatus,
  UpdateCompetencyScaleInput,
} from "@/types/performance";
import {
  defaultFormatForKind,
  MAX_DESCRIPTIVE_LEVELS,
} from "@/lib/performance/scale-format";

export type ScaleFormValues = {
  name: string;
  description: string;
  status: OrganizationEntityStatus;
  kind: CompetencyScaleKind;
  format: CompetencyScaleFormat;
  minValue: string;
  maxValue: string;
  likertIcon: string;
  currencyCode: string;
  decimalPlaces: string;
  descriptiveLabels: string[];
};

export const emptyScaleForm = (): ScaleFormValues => ({
  name: "",
  description: "",
  status: "ACTIVE",
  kind: "QUALITATIVE",
  format: "NUMERIC",
  minValue: "1",
  maxValue: "5",
  likertIcon: "STARS",
  currencyCode: "COP",
  decimalPlaces: "2",
  descriptiveLabels: Array.from({ length: MAX_DESCRIPTIVE_LEVELS }, () => ""),
});

function optionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function withKind(values: ScaleFormValues, kind: CompetencyScaleKind): ScaleFormValues {
  const format = defaultFormatForKind(kind);
  return {
    ...values,
    kind,
    format,
    minValue: kind === "QUANTITATIVE" ? "1" : "1",
    maxValue: kind === "QUANTITATIVE" ? "120" : "5",
  };
}

export function scaleToForm(scale: CompetencyScale): ScaleFormValues {
  const labels = Array.from({ length: MAX_DESCRIPTIVE_LEVELS }, () => "");
  if (scale.format === "DESCRIPTIVE") {
    const sorted = [...(scale.levels ?? [])].sort((a, b) => a.order - b.order);
    sorted.slice(0, MAX_DESCRIPTIVE_LEVELS).forEach((level, index) => {
      labels[index] = level.label;
    });
  }
  const kind = scale.kind ?? "QUALITATIVE";
  return {
    name: scale.name,
    description: scale.description ?? "",
    status: scale.status,
    kind,
    format: scale.format ?? defaultFormatForKind(kind),
    minValue: scale.minValue != null ? String(Number(scale.minValue)) : kind === "QUANTITATIVE" ? "1" : "1",
    maxValue:
      scale.maxValue != null
        ? String(Number(scale.maxValue))
        : kind === "QUANTITATIVE"
          ? "120"
          : "5",
    likertIcon: scale.likertIcon ?? "STARS",
    currencyCode: scale.currencyCode ?? "COP",
    decimalPlaces: String(scale.decimalPlaces ?? 2),
    descriptiveLabels: labels,
  };
}

export function toCreateScalePayload(
  values: ScaleFormValues,
): CreateCompetencyScaleInput {
  const base: CreateCompetencyScaleInput = {
    name: values.name.trim(),
    description: values.description.trim() || undefined,
    status: values.status,
    kind: values.kind,
    format: values.format,
  };

  if (values.kind === "QUALITATIVE" && values.format === "DESCRIPTIVE") {
    return {
      ...base,
      descriptiveLabels: values.descriptiveLabels,
    };
  }

  if (values.kind === "QUALITATIVE") {
    return {
      ...base,
      minValue: optionalNumber(values.minValue),
      maxValue: optionalNumber(values.maxValue),
      likertIcon:
        values.format === "LIKERT" ? values.likertIcon : undefined,
    };
  }

  if (values.format === "PERCENTAGE") {
    return {
      ...base,
      minValue: optionalNumber(values.minValue),
      maxValue: optionalNumber(values.maxValue),
    };
  }

  if (values.format === "CURRENCY") {
    return { ...base, currencyCode: values.currencyCode };
  }

  return {
    ...base,
    decimalPlaces: optionalNumber(values.decimalPlaces),
  };
}

export function toUpdateScalePayload(
  values: ScaleFormValues,
): UpdateCompetencyScaleInput {
  const created = toCreateScalePayload(values);
  return {
    ...created,
    description: created.description ?? null,
  };
}
