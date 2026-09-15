"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { FormSelect } from "@/components/organization/form-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCompanyId } from "@/hooks/use-company-id";
import { atsApi, atsKeys } from "@/lib/api/ats";
import { getErrorMessage } from "@/lib/api/errors";
import {
  SCREENING_QUESTION_TYPE_LABELS,
  SCREENING_QUESTION_TYPES,
} from "@/lib/ats/labels";
import {
  ALL_OF_THE_ABOVE_LABEL,
  CHOICE_OPTION_MAX,
  CHOICE_OPTION_MIN,
  defaultChoiceOptions,
  isBooleanScreeningType,
  isChoiceScreeningType,
  newScreeningOption,
  optionLetter,
} from "@/lib/ats/screening";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type {
  ScreeningOption,
  ScreeningQuestionType,
  VacancyScreeningConfig,
} from "@/types/ats";

type ScreeningRow = {
  key: string;
  prompt: string;
  type: ScreeningQuestionType;
  correctAnswer: boolean;
  options: ScreeningOption[];
  correctOptionIds: string[];
};

type ScreeningDraft = {
  rows: ScreeningRow[];
  minCorrect: string;
};

function toDraft(data: VacancyScreeningConfig): ScreeningDraft {
  return {
    rows: data.questions.map((question) => ({
      key: question.id,
      prompt: question.prompt,
      type: question.type ?? "YES_NO",
      correctAnswer: question.correctAnswer ?? true,
      options: question.options ?? [],
      correctOptionIds: question.correctOptionIds ?? [],
    })),
    minCorrect: String(data.minCorrect ?? Math.max(data.questions.length, 0)),
  };
}

function emptyRow(type: ScreeningQuestionType = "YES_NO"): ScreeningRow {
  return {
    key: `new-${crypto.randomUUID()}`,
    prompt: "",
    type,
    correctAnswer: true,
    options: isChoiceScreeningType(type) ? defaultChoiceOptions() : [],
    correctOptionIds: [],
  };
}

function applyType(row: ScreeningRow, type: ScreeningQuestionType): ScreeningRow {
  if (isBooleanScreeningType(type)) {
    return {
      ...row,
      type,
      options: [],
      correctOptionIds: [],
    };
  }
  const options =
    row.options.length >= CHOICE_OPTION_MIN
      ? row.options
      : defaultChoiceOptions();
  return {
    ...row,
    type,
    options,
    correctOptionIds:
      type === "SINGLE_CHOICE"
        ? row.correctOptionIds.slice(0, 1)
        : row.correctOptionIds,
  };
}

function serializeRow(row: ScreeningRow) {
  const prompt = row.prompt.trim();
  if (isBooleanScreeningType(row.type)) {
    return {
      prompt,
      type: row.type,
      correctAnswer: row.correctAnswer,
    };
  }
  const options = row.options
    .map((option) => ({
      id: option.id,
      label: option.isAllOfTheAbove
        ? option.label.trim() || ALL_OF_THE_ABOVE_LABEL
        : option.label.trim(),
      isAllOfTheAbove: option.isAllOfTheAbove === true,
    }))
    .filter((option) => option.label.length > 0);
  return {
    prompt,
    type: row.type,
    options,
    correctOptionIds: row.correctOptionIds.filter((id) =>
      options.some((option) => option.id === id),
    ),
  };
}

function validateSerialized(row: ReturnType<typeof serializeRow>) {
  if (!row.prompt) return "Cada pregunta debe tener un enunciado.";
  if (isBooleanScreeningType(row.type)) return null;
  if (!row.options || row.options.length < CHOICE_OPTION_MIN) {
    return `Las preguntas de opción múltiple necesitan al menos ${CHOICE_OPTION_MIN} alternativas.`;
  }
  if (row.type === "SINGLE_CHOICE" && row.correctOptionIds.length !== 1) {
    return "Marca la alternativa correcta en cada pregunta de única respuesta.";
  }
  if (row.type === "MULTIPLE_CHOICE" && row.correctOptionIds.length < 1) {
    return "Marca al menos una alternativa correcta en cada pregunta de opción múltiple.";
  }
  return null;
}

export function VacancyScreeningSection({ vacancyId }: { vacancyId: string }) {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ScreeningDraft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const screeningQuery = useQuery({
    queryKey: atsKeys.vacancyScreening(companyId, vacancyId),
    queryFn: () => atsApi.getVacancyScreening(vacancyId),
  });

  const serverDraft = screeningQuery.data
    ? toDraft(screeningQuery.data)
    : null;
  const active = draft ?? serverDraft;
  const rows = active?.rows ?? [];
  const minCorrect = active?.minCorrect ?? "1";

  const setRows = (updater: (current: ScreeningRow[]) => ScreeningRow[]) => {
    setDraft((current) => {
      const base = current ?? serverDraft ?? { rows: [], minCorrect: "1" };
      return { ...base, rows: updater(base.rows) };
    });
  };

  const patchRow = (key: string, updater: (row: ScreeningRow) => ScreeningRow) => {
    setRows((current) =>
      current.map((item) => (item.key === key ? updater(item) : item)),
    );
  };

  const setMinCorrect = (value: string) => {
    setDraft((current) => {
      const base = current ?? serverDraft ?? { rows: [], minCorrect: "1" };
      return { ...base, minCorrect: value };
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const cleaned = rows
        .map(serializeRow)
        .filter((row) => row.prompt.length > 0);
      for (const row of cleaned) {
        const error = validateSerialized(row);
        if (error) throw new Error(error);
      }
      const min = cleaned.length === 0 ? null : Number(minCorrect);
      if (cleaned.length > 0 && (!Number.isInteger(min) || (min ?? 0) < 0)) {
        throw new Error("El mínimo de aciertos debe ser un entero válido.");
      }
      if (min != null && min > cleaned.length) {
        throw new Error(
          "El mínimo de aciertos no puede superar el número de preguntas.",
        );
      }
      return atsApi.updateVacancyScreening(vacancyId, {
        minCorrect: min,
        questions: cleaned,
      });
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: atsKeys.vacancyScreening(companyId, vacancyId),
      });
      await queryClient.invalidateQueries({
        queryKey: atsKeys.vacancy(companyId, vacancyId),
      });
      setDraft(toDraft(data));
      setFormError(null);
      notifySuccess("Screening guardado");
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, "No se pudo guardar el screening."));
      notifyError(error, "No se pudo guardar el screening.");
    },
  });

  if (screeningQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando screening…</p>;
  }

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div>
        <h2 className="text-lg font-semibold">Preguntas de screening</h2>
        <p className="text-sm text-muted-foreground">
          Preguntas con respuesta correcta. El candidato debe alcanzar el mínimo
          de aciertos para postularse. Puedes usar Sí/No, verdadero/falso,
          opción única (ABCD) u opción múltiple, incluida “todas las
          anteriores”.
        </p>
      </div>

      <div className="max-w-xs space-y-2">
        <Label htmlFor="screening-min">Mínimo de respuestas correctas</Label>
        <Input
          id="screening-min"
          type="number"
          min={0}
          max={50}
          value={minCorrect}
          onChange={(event) => setMinCorrect(event.target.value)}
          disabled={rows.length === 0}
        />
      </div>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={row.key} className="space-y-3 rounded-md border p-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor={`screen-q-${row.key}`}>
                  Pregunta {index + 1}
                </Label>
                <Input
                  id={`screen-q-${row.key}`}
                  value={row.prompt}
                  maxLength={500}
                  onChange={(event) =>
                    patchRow(row.key, (item) => ({
                      ...item,
                      prompt: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="w-52 shrink-0">
                <FormSelect
                  id={`screen-type-${row.key}`}
                  label="Tipo"
                  value={row.type}
                  onChange={(value) =>
                    patchRow(row.key, (item) =>
                      applyType(item, value as ScreeningQuestionType),
                    )
                  }
                  options={SCREENING_QUESTION_TYPES.map((type) => ({
                    value: type,
                    label: SCREENING_QUESTION_TYPE_LABELS[type],
                  }))}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-7"
                onClick={() =>
                  setRows((current) =>
                    current.filter((item) => item.key !== row.key),
                  )
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            {isBooleanScreeningType(row.type) ? (
              <BooleanAnswerEditor
                row={row}
                onChange={(correctAnswer) =>
                  patchRow(row.key, (item) => ({ ...item, correctAnswer }))
                }
              />
            ) : (
              <ChoiceAnswerEditor
                row={row}
                onChange={(updater) => patchRow(row.key, updater)}
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setRows((current) => [...current, emptyRow()])}
        >
          <Plus className="size-4" />
          Agregar pregunta
        </Button>
        <Button
          type="button"
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? "Guardando…" : "Guardar screening"}
        </Button>
      </div>
      {formError ? (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      ) : null}
    </section>
  );
}

function BooleanAnswerEditor({
  row,
  onChange,
}: {
  row: ScreeningRow;
  onChange: (correctAnswer: boolean) => void;
}) {
  const trueLabel = row.type === "TRUE_FALSE" ? "Verdadero" : "Sí";
  const falseLabel = row.type === "TRUE_FALSE" ? "Falso" : "No";
  return (
    <div className="flex flex-wrap gap-4 text-sm">
      <label className="flex items-center gap-2">
        <input
          type="radio"
          name={`correct-${row.key}`}
          checked={row.correctAnswer === true}
          onChange={() => onChange(true)}
        />
        Respuesta correcta: {trueLabel}
      </label>
      <label className="flex items-center gap-2">
        <input
          type="radio"
          name={`correct-${row.key}`}
          checked={row.correctAnswer === false}
          onChange={() => onChange(false)}
        />
        Respuesta correcta: {falseLabel}
      </label>
    </div>
  );
}

function ChoiceAnswerEditor({
  row,
  onChange,
}: {
  row: ScreeningRow;
  onChange: (updater: (item: ScreeningRow) => ScreeningRow) => void;
}) {
  const multiple = row.type === "MULTIPLE_CHOICE";
  const hasAllOfTheAbove = row.options.some((option) => option.isAllOfTheAbove);
  const canAddOption = row.options.length < CHOICE_OPTION_MAX;

  const setCorrect = (optionId: string, checked: boolean) => {
    onChange((item) => {
      if (!multiple) {
        return { ...item, correctOptionIds: [optionId] };
      }
      const option = item.options.find((entry) => entry.id === optionId);
      const regularIds = item.options
        .filter((entry) => !entry.isAllOfTheAbove)
        .map((entry) => entry.id);
      const allId = item.options.find((entry) => entry.isAllOfTheAbove)?.id;
      const selected = new Set(item.correctOptionIds);
      if (option?.isAllOfTheAbove) {
        return {
          ...item,
          correctOptionIds: checked
            ? allId
              ? [...regularIds, allId]
              : regularIds
            : [],
        };
      }
      if (checked) selected.add(optionId);
      else selected.delete(optionId);
      if (allId) selected.delete(allId);
      if (allId && regularIds.every((id) => selected.has(id))) {
        selected.add(allId);
      }
      return { ...item, correctOptionIds: [...selected] };
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {multiple
          ? "Marca todas las alternativas correctas. “Todas las anteriores” cuenta como seleccionar el resto."
          : "Marca la única alternativa correcta."}
      </p>
      <div className="space-y-2">
        {row.options.map((option, optionIndex) => {
          const checked = row.correctOptionIds.includes(option.id);
          return (
            <div key={option.id} className="flex items-center gap-2">
              <label className="flex shrink-0 items-center gap-2 text-sm">
                <input
                  type={multiple ? "checkbox" : "radio"}
                  name={multiple ? undefined : `choice-correct-${row.key}`}
                  checked={checked}
                  onChange={(event) =>
                    setCorrect(
                      option.id,
                      multiple ? event.target.checked : true,
                    )
                  }
                />
                <span className="w-5 font-medium">
                  {optionLetter(optionIndex)}.
                </span>
              </label>
              <Input
                value={
                  option.isAllOfTheAbove
                    ? option.label || ALL_OF_THE_ABOVE_LABEL
                    : option.label
                }
                maxLength={300}
                readOnly={option.isAllOfTheAbove}
                placeholder={`Alternativa ${optionLetter(optionIndex)}`}
                onChange={(event) =>
                  onChange((item) => ({
                    ...item,
                    options: item.options.map((entry) =>
                      entry.id === option.id
                        ? { ...entry, label: event.target.value }
                        : entry,
                    ),
                  }))
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={row.options.length <= CHOICE_OPTION_MIN}
                onClick={() =>
                  onChange((item) => ({
                    ...item,
                    options: item.options.filter(
                      (entry) => entry.id !== option.id,
                    ),
                    correctOptionIds: item.correctOptionIds.filter(
                      (id) => id !== option.id,
                    ),
                  }))
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canAddOption}
          onClick={() =>
            onChange((item) => {
              const next = newScreeningOption();
              const allIndex = item.options.findIndex(
                (option) => option.isAllOfTheAbove,
              );
              const options =
                allIndex >= 0
                  ? [
                      ...item.options.slice(0, allIndex),
                      next,
                      ...item.options.slice(allIndex),
                    ]
                  : [...item.options, next];
              return { ...item, options };
            })
          }
        >
          <Plus className="size-4" />
          Agregar alternativa
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={hasAllOfTheAbove || !canAddOption}
          onClick={() =>
            onChange((item) => ({
              ...item,
              options: [
                ...item.options,
                newScreeningOption(ALL_OF_THE_ABOVE_LABEL, true),
              ],
            }))
          }
        >
          Agregar “todas las anteriores”
        </Button>
      </div>
    </div>
  );
}
