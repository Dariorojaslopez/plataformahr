"use client";

import type { Dispatch, SetStateAction } from "react";
import { FormSelect } from "@/components/organization/form-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CycleFormState } from "@/lib/performance/cycle-form";
import {
  resultCompositionWeightsAreValid,
  sumResultCompositionWeights,
} from "@/lib/performance/result-composition-weights";

type GoalCycleOption = {
  value: string;
  label: string;
};

type CycleCompositionFieldsProps = {
  form: CycleFormState;
  setForm: Dispatch<SetStateAction<CycleFormState>>;
  goalCycleOptions: GoalCycleOption[];
  goalCyclesLoading?: boolean;
  idPrefix?: string;
};

export function CycleCompositionFields({
  form,
  setForm,
  goalCycleOptions,
  goalCyclesLoading = false,
  idPrefix = "cycle",
}: CycleCompositionFieldsProps) {
  const compositionSum = form.includeGoals
    ? sumResultCompositionWeights(
        form.competencyResultWeight,
        form.goalsResultWeight,
      )
    : null;
  const compositionValid =
    !form.includeGoals ||
    (form.goalCycleId.trim() !== "" &&
      resultCompositionWeightsAreValid(
        form.competencyResultWeight,
        form.goalsResultWeight,
      ));

  return (
    <div className="space-y-4 rounded-md border border-border p-3">
      <div>
        <p className="text-sm font-medium">Composición del resultado</p>
        <p className="text-xs text-muted-foreground">
          Define cómo se combinan competencias y objetivos en el resultado
          overall. La ponderación de evaluadores (auto / líder) es independiente
          y aplica solo a competencias.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id={`${idPrefix}-include-goals`}
          checked={form.includeGoals}
          onCheckedChange={(checked) =>
            setForm((f) => ({
              ...f,
              includeGoals: checked === true,
            }))
          }
        />
        <Label htmlFor={`${idPrefix}-include-goals`}>Incluir objetivos</Label>
      </div>

      {form.includeGoals ? (
        <div className="space-y-4 border-l-2 border-muted pl-3">
          <FormSelect
            id={`${idPrefix}-goal-cycle`}
            label="Ciclo de objetivos"
            required
            disabled={goalCyclesLoading}
            value={form.goalCycleId}
            onChange={(goalCycleId) =>
              setForm((f) => ({ ...f, goalCycleId }))
            }
            options={goalCycleOptions}
            emptyLabel={
              goalCyclesLoading ? "Cargando…" : "Selecciona un ciclo"
            }
          />

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Resultado general
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-comp-result-weight`}>
                  Peso competencias (%)
                </Label>
                <Input
                  id={`${idPrefix}-comp-result-weight`}
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={form.competencyResultWeight}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      competencyResultWeight: e.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-goals-result-weight`}>
                  Peso objetivos (%)
                </Label>
                <Input
                  id={`${idPrefix}-goals-result-weight`}
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={form.goalsResultWeight}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      goalsResultWeight: e.target.value,
                    }))
                  }
                  required
                />
              </div>
            </div>
            {compositionSum != null && !compositionValid ? (
              <p className="mt-2 text-xs text-destructive">
                Competencias + objetivos deben sumar 100% (actual:{" "}
                {compositionSum.toFixed(2)}%).
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Competencias</p>
        <p className="mt-1">
          Autoevaluación {form.selfEvaluationWeight}% · Líder{" "}
          {form.managerEvaluationWeight}%
        </p>
        {form.includeGoals ? (
          <>
            <p className="mt-2 font-medium text-foreground">Resultado general</p>
            <p className="mt-1">
              Competencias {form.competencyResultWeight}% · Objetivos{" "}
              {form.goalsResultWeight}%
            </p>
          </>
        ) : (
          <p className="mt-2">Resultado general: 100% competencias.</p>
        )}
      </div>
    </div>
  );
}
