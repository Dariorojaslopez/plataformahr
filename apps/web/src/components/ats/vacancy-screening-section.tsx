"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCompanyId } from "@/hooks/use-company-id";
import { atsApi, atsKeys } from "@/lib/api/ats";
import { getErrorMessage } from "@/lib/api/errors";
import { notifyError, notifySuccess } from "@/lib/ui/notify";

type ScreeningRow = {
  key: string;
  prompt: string;
  correctAnswer: boolean;
};

type ScreeningDraft = {
  rows: ScreeningRow[];
  minCorrect: string;
};

function toDraft(data: {
  questions: Array<{ id: string; prompt: string; correctAnswer: boolean }>;
  minCorrect: number | null;
}): ScreeningDraft {
  return {
    rows: data.questions.map((question) => ({
      key: question.id,
      prompt: question.prompt,
      correctAnswer: question.correctAnswer,
    })),
    minCorrect: String(
      data.minCorrect ?? Math.max(data.questions.length, 0),
    ),
  };
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

  const setMinCorrect = (value: string) => {
    setDraft((current) => {
      const base = current ?? serverDraft ?? { rows: [], minCorrect: "1" };
      return { ...base, minCorrect: value };
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const cleaned = rows
        .map((row) => ({
          prompt: row.prompt.trim(),
          correctAnswer: row.correctAnswer,
        }))
        .filter((row) => row.prompt.length > 0);
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
          Preguntas Sí/No con respuesta correcta. El candidato debe alcanzar el
          mínimo de aciertos para postularse.
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
          <div key={row.key} className="space-y-2 rounded-md border p-3">
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor={`screen-q-${row.key}`}>
                  Pregunta {index + 1}
                </Label>
                <Input
                  id={`screen-q-${row.key}`}
                  value={row.prompt}
                  maxLength={500}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((item) =>
                        item.key === row.key
                          ? { ...item, prompt: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setRows((current) =>
                    current.filter((item) => item.key !== row.key),
                  )
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${row.key}`}
                  checked={row.correctAnswer === true}
                  onChange={() =>
                    setRows((current) =>
                      current.map((item) =>
                        item.key === row.key
                          ? { ...item, correctAnswer: true }
                          : item,
                      ),
                    )
                  }
                />
                Respuesta correcta: Sí
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${row.key}`}
                  checked={row.correctAnswer === false}
                  onChange={() =>
                    setRows((current) =>
                      current.map((item) =>
                        item.key === row.key
                          ? { ...item, correctAnswer: false }
                          : item,
                      ),
                    )
                  }
                />
                Respuesta correcta: No
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setRows((current) => [
              ...current,
              {
                key: `new-${Date.now()}-${current.length}`,
                prompt: "",
                correctAnswer: true,
              },
            ])
          }
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
