import type {
  ScreeningOption,
  ScreeningQuestionType,
} from "@/types/ats";

export const ALL_OF_THE_ABOVE_LABEL = "Todas las anteriores";
export const CHOICE_OPTION_MIN = 2;
export const CHOICE_OPTION_MAX = 8;

export function isBooleanScreeningType(
  type: ScreeningQuestionType,
): type is "YES_NO" | "TRUE_FALSE" {
  return type === "YES_NO" || type === "TRUE_FALSE";
}

export function isChoiceScreeningType(
  type: ScreeningQuestionType,
): type is "SINGLE_CHOICE" | "MULTIPLE_CHOICE" {
  return type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE";
}

export function optionLetter(index: number) {
  return String.fromCharCode(65 + index);
}

export function newScreeningOption(
  label = "",
  isAllOfTheAbove = false,
): ScreeningOption {
  return {
    id: crypto.randomUUID(),
    label,
    isAllOfTheAbove,
  };
}

export function defaultChoiceOptions(): ScreeningOption[] {
  return Array.from({ length: 4 }, () => newScreeningOption());
}

export function formatBooleanScreeningAnswer(
  type: ScreeningQuestionType,
  value: boolean | null | undefined,
) {
  if (value == null) return "Sin respuesta";
  if (type === "TRUE_FALSE") return value ? "Verdadero" : "Falso";
  return value ? "Sí" : "No";
}

export function formatScreeningChoiceLabels(
  options: ScreeningOption[] | null | undefined,
  selectedIds: string[] | null | undefined,
) {
  const opts = options ?? [];
  const ids = new Set(selectedIds ?? []);
  const picked = opts.filter((option) => ids.has(option.id));
  if (picked.length === 0) return "Sin respuesta";
  return picked
    .map((option) => {
      const index = opts.findIndex((item) => item.id === option.id);
      return `${optionLetter(index)}. ${option.label}`;
    })
    .join(", ");
}

export function toggleMultipleChoiceSelection(
  selectedIds: string[],
  optionId: string,
  options: ScreeningOption[],
) {
  const option = options.find((item) => item.id === optionId);
  const regularIds = options
    .filter((item) => !item.isAllOfTheAbove)
    .map((item) => item.id);
  const allId = options.find((item) => item.isAllOfTheAbove)?.id;

  if (option?.isAllOfTheAbove) {
    const alreadySelected =
      Boolean(allId && selectedIds.includes(allId)) &&
      regularIds.every((id) => selectedIds.includes(id));
    if (alreadySelected) return [];
    return allId ? [...regularIds, allId] : regularIds;
  }

  const next = new Set(selectedIds.filter((id) => id !== allId));
  if (next.has(optionId)) next.delete(optionId);
  else next.add(optionId);
  if (allId && regularIds.length > 0 && regularIds.every((id) => next.has(id))) {
    next.add(allId);
  }
  return [...next];
}
