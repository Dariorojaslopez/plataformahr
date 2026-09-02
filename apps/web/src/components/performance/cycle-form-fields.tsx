"use client";

import type { Dispatch, SetStateAction } from "react";
import { Plus, Trash2 } from "lucide-react";
import { FormSelect } from "@/components/organization/form-select";
import { CycleCompositionFields } from "@/components/performance/cycle-composition-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CycleFormState } from "@/lib/performance/cycle-form";
import {
  EVALUATION_MODEL_OPTIONS,
  EXTRA_EVALUATOR_LABELS,
  extraEvaluatorRoles,
} from "@/lib/performance/evaluation-model";

type CycleFormFieldsProps = {
  form: CycleFormState;
  setForm: Dispatch<SetStateAction<CycleFormState>>;
  idPrefix?: string;
  lockStartDate?: boolean;
};

function DatePair({
  startId,
  endId,
  startLabel,
  endLabel,
  startValue,
  endValue,
  onStart,
  onEnd,
  startRequired,
  startDisabled,
}: {
  startId: string;
  endId: string;
  startLabel: string;
  endLabel: string;
  startValue: string;
  endValue: string;
  onStart: (value: string) => void;
  onEnd: (value: string) => void;
  startRequired?: boolean;
  startDisabled?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={startId}>
          {startLabel}
          {startRequired ? " *" : ""}
        </Label>
        <Input
          id={startId}
          type="date"
          value={startValue}
          onChange={(e) => onStart(e.target.value)}
          required={startRequired}
          disabled={startDisabled}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={endId}>{endLabel}{startRequired ? " *" : ""}</Label>
        <Input
          id={endId}
          type="date"
          value={endValue}
          onChange={(e) => onEnd(e.target.value)}
          required={startRequired}
        />
      </div>
    </div>
  );
}

export function CycleFormFields({
  form,
  setForm,
  idPrefix = "cycle",
  lockStartDate = false,
}: CycleFormFieldsProps) {
  const extraRoles = extraEvaluatorRoles(form.evaluationModel);

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-name`}>Nombre *</Label>
        <Input
          id={`${idPrefix}-name`}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-description`}>Descripción</Label>
        <Textarea
          id={`${idPrefix}-description`}
          value={form.description}
          onChange={(e) =>
            setForm((f) => ({ ...f, description: e.target.value }))
          }
          rows={3}
        />
      </div>

      <FormSelect
        id={`${idPrefix}-eval-model`}
        label="Modelo de Evaluación"
        required
        value={form.evaluationModel}
        onChange={(evaluationModel) =>
          setForm((f) => ({
            ...f,
            evaluationModel: evaluationModel as CycleFormState["evaluationModel"],
          }))
        }
        options={EVALUATION_MODEL_OPTIONS}
      />

      <DatePair
        startId={`${idPrefix}-start`}
        endId={`${idPrefix}-end`}
        startLabel="Apertura del Ciclo"
        endLabel="Cierre del Ciclo"
        startValue={form.startDate}
        endValue={form.endDate}
        startRequired
        startDisabled={lockStartDate}
        onStart={(startDate) => setForm((f) => ({ ...f, startDate }))}
        onEnd={(endDate) => setForm((f) => ({ ...f, endDate }))}
      />

      <DatePair
        startId={`${idPrefix}-eval-start`}
        endId={`${idPrefix}-eval-end`}
        startLabel="Fecha Autoevaluación"
        endLabel="Fin autoevaluación"
        startValue={form.evaluationStartDate}
        endValue={form.evaluationEndDate}
        onStart={(evaluationStartDate) =>
          setForm((f) => ({ ...f, evaluationStartDate }))
        }
        onEnd={(evaluationEndDate) =>
          setForm((f) => ({ ...f, evaluationEndDate }))
        }
      />

      <DatePair
        startId={`${idPrefix}-goal-def-start`}
        endId={`${idPrefix}-goal-def-end`}
        startLabel="Fecha de definición de objetivos"
        endLabel="Fin definición de objetivos"
        startValue={form.goalDefinitionStartDate}
        endValue={form.goalDefinitionEndDate}
        onStart={(goalDefinitionStartDate) =>
          setForm((f) => ({ ...f, goalDefinitionStartDate }))
        }
        onEnd={(goalDefinitionEndDate) =>
          setForm((f) => ({ ...f, goalDefinitionEndDate }))
        }
      />

      <div className="space-y-3 rounded-md border border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Fechas de seguimiento</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setForm((f) => ({
                ...f,
                followUps: [...f.followUps, { startDate: "", endDate: "" }],
              }))
            }
          >
            <Plus className="h-4 w-4" aria-hidden />
            Agregar seguimiento
          </Button>
        </div>
        {form.followUps.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No hay seguimientos. Puedes agregar uno o más rangos de fechas.
          </p>
        ) : (
          form.followUps.map((row, index) => (
            <div key={`${idPrefix}-follow-${index}`} className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  Seguimiento {index + 1}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      followUps: f.followUps.filter((_, i) => i !== index),
                    }))
                  }
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Quitar
                </Button>
              </div>
              <DatePair
                startId={`${idPrefix}-follow-${index}-start`}
                endId={`${idPrefix}-follow-${index}-end`}
                startLabel="Fecha inicio"
                endLabel="Fecha fin"
                startValue={row.startDate}
                endValue={row.endDate}
                onStart={(startDate) =>
                  setForm((f) => ({
                    ...f,
                    followUps: f.followUps.map((item, i) =>
                      i === index ? { ...item, startDate } : item,
                    ),
                  }))
                }
                onEnd={(endDate) =>
                  setForm((f) => ({
                    ...f,
                    followUps: f.followUps.map((item, i) =>
                      i === index ? { ...item, endDate } : item,
                    ),
                  }))
                }
              />
            </div>
          ))
        )}
      </div>

      <DatePair
        startId={`${idPrefix}-mgr-eval-start`}
        endId={`${idPrefix}-mgr-eval-end`}
        startLabel="Fecha Evaluación"
        endLabel="Fin evaluación"
        startValue={form.managerEvaluationStartDate}
        endValue={form.managerEvaluationEndDate}
        onStart={(managerEvaluationStartDate) =>
          setForm((f) => ({ ...f, managerEvaluationStartDate }))
        }
        onEnd={(managerEvaluationEndDate) =>
          setForm((f) => ({ ...f, managerEvaluationEndDate }))
        }
      />

      <DatePair
        startId={`${idPrefix}-cal-start`}
        endId={`${idPrefix}-cal-end`}
        startLabel="Fecha Calibración"
        endLabel="Fin calibración"
        startValue={form.calibrationStartDate}
        endValue={form.calibrationEndDate}
        onStart={(calibrationStartDate) =>
          setForm((f) => ({ ...f, calibrationStartDate }))
        }
        onEnd={(calibrationEndDate) =>
          setForm((f) => ({ ...f, calibrationEndDate }))
        }
      />

      <DatePair
        startId={`${idPrefix}-close-start`}
        endId={`${idPrefix}-close-end`}
        startLabel="Fecha sesión de cierre"
        endLabel="Fin sesión de cierre"
        startValue={form.closingStartDate}
        endValue={form.closingEndDate}
        onStart={(closingStartDate) =>
          setForm((f) => ({ ...f, closingStartDate }))
        }
        onEnd={(closingEndDate) =>
          setForm((f) => ({ ...f, closingEndDate }))
        }
      />

      <div className="space-y-3 rounded-md border border-border p-3">
        <div>
          <p className="text-sm font-medium">Ponderación de evaluadores</p>
          <p className="text-xs text-muted-foreground">
            Los grupos habilitados por el modelo deben sumar 100%.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-self-weight`}>Autoevaluación (%)</Label>
            <Input
              id={`${idPrefix}-self-weight`}
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.selfEvaluationWeight}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  selfEvaluationWeight: e.target.value,
                }))
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-manager-weight`}>Líder (%)</Label>
            <Input
              id={`${idPrefix}-manager-weight`}
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.managerEvaluationWeight}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  managerEvaluationWeight: e.target.value,
                }))
              }
              required
            />
          </div>
          {extraRoles.includes("peer") ? (
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-peer-weight`}>
                {EXTRA_EVALUATOR_LABELS.peer} (%)
              </Label>
              <Input
                id={`${idPrefix}-peer-weight`}
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={form.peerEvaluationWeight}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    peerEvaluationWeight: e.target.value,
                  }))
                }
                required
              />
            </div>
          ) : null}
          {extraRoles.includes("report") ? (
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-report-weight`}>
                {EXTRA_EVALUATOR_LABELS.report} (%)
              </Label>
              <Input
                id={`${idPrefix}-report-weight`}
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={form.reportEvaluationWeight}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    reportEvaluationWeight: e.target.value,
                  }))
                }
                required
              />
            </div>
          ) : null}
          {extraRoles.includes("client") ? (
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-client-weight`}>
                {EXTRA_EVALUATOR_LABELS.client} (%)
              </Label>
              <Input
                id={`${idPrefix}-client-weight`}
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={form.clientEvaluationWeight}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    clientEvaluationWeight: e.target.value,
                  }))
                }
                required
              />
            </div>
          ) : null}
        </div>
      </div>

      <CycleCompositionFields
        form={form}
        setForm={setForm}
        idPrefix={idPrefix}
      />
    </>
  );
}
