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
  const range = form.evaluationRange === "120" ? 120 : 100;
  const competencyWeight = form.includeCompetencies
    ? form.competencyResultWeight
    : "0";
  const compositionSum = sumResultCompositionWeights(
    competencyWeight,
    form.organizationalGoalsWeight,
    form.individualGoalsWeight,
  );
  const hasGoals =
    (Number(form.organizationalGoalsWeight) || 0) +
      (Number(form.individualGoalsWeight) || 0) >
    0;
  const compositionValid =
    (!form.includeCompetencies && !hasGoals) === false &&
    (!hasGoals ||
      (form.goalCycleId.trim() !== "" &&
        resultCompositionWeightsAreValid(
          competencyWeight,
          form.organizationalGoalsWeight,
          form.individualGoalsWeight,
          range,
        )));

  return (
    <div className="space-y-4 rounded-md border border-border p-3">
      <div>
        <p className="text-sm font-medium">
          Incluir Competencias en la evaluación
        </p>
        <p className="text-xs text-muted-foreground">
          Define cómo se combinan competencias y objetivos. La suma no puede
          superar el rango total de evaluación. La ponderación de evaluadores
          aplica solo a competencias.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id={`${idPrefix}-include-competencies`}
          checked={form.includeCompetencies}
          onCheckedChange={(checked) =>
            setForm((f) => ({
              ...f,
              includeCompetencies: checked === true,
            }))
          }
        />
        <Label htmlFor={`${idPrefix}-include-competencies`}>
          Activar evaluación de competencias
        </Label>
      </div>

      <FormSelect
        id={`${idPrefix}-eval-range`}
        label="Rango total de evaluación"
        value={form.evaluationRange}
        onChange={(evaluationRange) =>
          setForm((f) => ({
            ...f,
            evaluationRange: evaluationRange === "120" ? "120" : "100",
          }))
        }
        options={[
          { value: "100", label: "100%" },
          { value: "120", label: "120%" },
        ]}
      />

      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Ponderación sobre el resultado ({range}%)
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-comp-result-weight`}>
              Competencias (%)
            </Label>
            <Input
              id={`${idPrefix}-comp-result-weight`}
              type="number"
              min={0}
              max={range}
              step="0.01"
              value={form.competencyResultWeight}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  competencyResultWeight: e.target.value,
                }))
              }
              disabled={!form.includeCompetencies}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-org-goals-weight`}>
              Objetivos organizacionales (%)
            </Label>
            <Input
              id={`${idPrefix}-org-goals-weight`}
              type="number"
              min={0}
              max={range}
              step="0.01"
              value={form.organizationalGoalsWeight}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  organizationalGoalsWeight: e.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-ind-goals-weight`}>
              Objetivos individuales (%)
            </Label>
            <Input
              id={`${idPrefix}-ind-goals-weight`}
              type="number"
              min={0}
              max={range}
              step="0.01"
              value={form.individualGoalsWeight}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  individualGoalsWeight: e.target.value,
                }))
              }
            />
          </div>
        </div>
        {compositionSum != null && !compositionValid ? (
          <p className="mt-2 text-xs text-destructive">
            La suma no puede superar {range}% (actual: {compositionSum.toFixed(2)}
            %).
          </p>
        ) : null}
      </div>

      {hasGoals ? (
        <FormSelect
          id={`${idPrefix}-goal-cycle`}
          label="Ciclo de objetivos"
          required
          disabled={goalCyclesLoading}
          value={form.goalCycleId}
          onChange={(goalCycleId) => setForm((f) => ({ ...f, goalCycleId }))}
          options={goalCycleOptions}
          emptyLabel={goalCyclesLoading ? "Cargando…" : "Selecciona un ciclo"}
        />
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-max-objectives`}>
          Máximo de objetivos
        </Label>
        <Input
          id={`${idPrefix}-max-objectives`}
          type="number"
          min={1}
          step={1}
          value={form.maxObjectives}
          onChange={(e) =>
            setForm((f) => ({ ...f, maxObjectives: e.target.value }))
          }
        />
        <p className="text-xs text-muted-foreground">
          La cantidad de objetivos definida incluye los objetivos
          organizacionales e individuales.
        </p>
      </div>

      <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Competencias</p>
        <p className="mt-1">
          {form.includeCompetencies
            ? `Autoevaluación ${form.selfEvaluationWeight}% · Líder ${form.managerEvaluationWeight}%`
            : "Evaluación de competencias desactivada."}
        </p>
        <p className="mt-2 font-medium text-foreground">Resultado general</p>
        <p className="mt-1">
          Competencias {form.includeCompetencies ? form.competencyResultWeight : 0}
          % · Organizacionales {form.organizationalGoalsWeight}% · Individuales{" "}
          {form.individualGoalsWeight}% (rango {range}%).
        </p>
      </div>
    </div>
  );
}
