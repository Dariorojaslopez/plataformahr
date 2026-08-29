import type {
  CompetencyScaleFormat,
  CompetencyScaleKind,
  LikertIcon,
} from "@/types/performance";

export const QUALITATIVE_SCALE_FORMATS: CompetencyScaleFormat[] = [
  "NUMERIC",
  "DESCRIPTIVE",
  "LIKERT",
];

export const QUANTITATIVE_SCALE_FORMATS: CompetencyScaleFormat[] = [
  "PERCENTAGE",
  "CURRENCY",
  "NUMERIC",
];

export const COMPETENCY_SCALE_FORMAT_LABELS: Record<
  CompetencyScaleFormat,
  string
> = {
  NUMERIC: "Numérica",
  DESCRIPTIVE: "Descriptiva",
  LIKERT: "Likert",
  PERCENTAGE: "Porcentaje",
  CURRENCY: "Moneda",
};

export const LIKERT_ICON_OPTIONS: Array<{ value: LikertIcon; label: string }> = [
  { value: "STARS", label: "Estrellas" },
  { value: "HEARTS", label: "Corazones" },
  { value: "THUMBS", label: "Pulgares" },
  { value: "FACES", label: "Caras" },
];

export const CURRENCY_CODE_OPTIONS = [
  { value: "COP", label: "COP — Peso colombiano" },
  { value: "USD", label: "USD — Dólar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "MXN", label: "MXN — Peso mexicano" },
  { value: "CLP", label: "CLP — Peso chileno" },
  { value: "PEN", label: "PEN — Sol" },
  { value: "ARS", label: "ARS — Peso argentino" },
  { value: "BRL", label: "BRL — Real" },
];

export const MAX_DESCRIPTIVE_LEVELS = 5;

export function formatsForKind(
  kind: CompetencyScaleKind,
): CompetencyScaleFormat[] {
  return kind === "QUANTITATIVE"
    ? QUANTITATIVE_SCALE_FORMATS
    : QUALITATIVE_SCALE_FORMATS;
}

export function formatOptionsForKind(kind: CompetencyScaleKind) {
  return formatsForKind(kind).map((format) => ({
    value: format,
    label: COMPETENCY_SCALE_FORMAT_LABELS[format],
  }));
}

export function defaultFormatForKind(
  kind: CompetencyScaleKind,
): CompetencyScaleFormat {
  return kind === "QUANTITATIVE" ? "PERCENTAGE" : "NUMERIC";
}

export function scaleTypeLabel(
  kind: CompetencyScaleKind | undefined,
  format: CompetencyScaleFormat | undefined,
): string {
  const kindLabel = kind === "QUANTITATIVE" ? "Cuantitativa" : "Cualitativa";
  if (!format) return kindLabel;
  return `${kindLabel} · ${COMPETENCY_SCALE_FORMAT_LABELS[format]}`;
}

export function descriptiveLevelPercent(levelCount: number): number {
  if (levelCount <= 0) return 0;
  return Math.round(100 / levelCount);
}
