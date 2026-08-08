"use client";

import { FormSelect } from "@/components/organization/form-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  CreateVacancyRequestInput,
  UpdateVacancyRequestInput,
  VacancyRequest,
  VacancyRequestType,
} from "@/types/ats";

export type VacancyRequestFormValues = {
  type: VacancyRequestType;
  requestedByEmployeeId: string;
  existingPositionId: string;
  requestedPositionName: string;
  requestedAreaId: string;
  requestedJobLevelId: string;
  requestedHeadcount: string;
  justification: string;
  generalManagerApprovalRequired: boolean;
};

export const emptyVacancyRequestForm = (): VacancyRequestFormValues => ({
  type: "EXISTING_POSITION",
  requestedByEmployeeId: "",
  existingPositionId: "",
  requestedPositionName: "",
  requestedAreaId: "",
  requestedJobLevelId: "",
  requestedHeadcount: "1",
  justification: "",
  generalManagerApprovalRequired: false,
});

export function vacancyRequestToForm(
  request: VacancyRequest,
): VacancyRequestFormValues {
  return {
    type: request.type,
    requestedByEmployeeId: request.requestedByEmployeeId,
    existingPositionId: request.existingPositionId ?? "",
    requestedPositionName: request.requestedPositionName ?? "",
    requestedAreaId: request.requestedAreaId ?? "",
    requestedJobLevelId: request.requestedJobLevelId ?? "",
    requestedHeadcount: String(request.requestedHeadcount),
    justification: request.justification,
    generalManagerApprovalRequired: request.generalManagerApprovalRequired,
  };
}

export function toCreateVacancyRequestPayload(
  values: VacancyRequestFormValues,
): CreateVacancyRequestInput {
  const headcount = Number(values.requestedHeadcount);
  const base: CreateVacancyRequestInput = {
    type: values.type,
    requestedHeadcount: headcount,
    justification: values.justification.trim(),
    generalManagerApprovalRequired: values.generalManagerApprovalRequired,
  };
  if (values.requestedByEmployeeId) {
    base.requestedByEmployeeId = values.requestedByEmployeeId;
  }
  if (values.type === "EXISTING_POSITION") {
    base.existingPositionId = values.existingPositionId;
  } else {
    base.requestedPositionName = values.requestedPositionName.trim();
    base.requestedAreaId = values.requestedAreaId;
    if (values.requestedJobLevelId) {
      base.requestedJobLevelId = values.requestedJobLevelId;
    }
  }
  return base;
}

export function toUpdateVacancyRequestPayload(
  values: VacancyRequestFormValues,
): UpdateVacancyRequestInput {
  const created = toCreateVacancyRequestPayload(values);
  if (values.type === "EXISTING_POSITION") {
    return {
      ...created,
      requestedPositionName: null,
      requestedAreaId: null,
      requestedJobLevelId: values.requestedJobLevelId || null,
      existingPositionId: values.existingPositionId,
    };
  }
  return {
    ...created,
    existingPositionId: null,
    requestedJobLevelId: values.requestedJobLevelId || null,
  };
}

type Option = { value: string; label: string };

type VacancyRequestFormProps = {
  values: VacancyRequestFormValues;
  onChange: (values: VacancyRequestFormValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitting?: boolean;
  error?: string | null;
  positions: Option[];
  areas: Option[];
  jobLevels: Option[];
  employees: Option[];
  showRequesterSelector?: boolean;
  submitLabel?: string;
};

export function VacancyRequestForm({
  values,
  onChange,
  onSubmit,
  onCancel,
  submitting,
  error,
  positions,
  areas,
  jobLevels,
  employees,
  showRequesterSelector = true,
  submitLabel = "Guardar",
}: VacancyRequestFormProps) {
  function setType(type: VacancyRequestType) {
    if (type === "EXISTING_POSITION") {
      onChange({
        ...values,
        type,
        requestedPositionName: "",
        requestedAreaId: "",
        requestedJobLevelId: "",
      });
      return;
    }
    onChange({
      ...values,
      type,
      existingPositionId: "",
    });
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <FormSelect
        id="vr-type"
        label="Tipo"
        required
        value={values.type}
        onChange={(value) => setType(value as VacancyRequestType)}
        options={[
          { value: "EXISTING_POSITION", label: "Cargo existente" },
          { value: "NEW_POSITION", label: "Cargo nuevo" },
        ]}
      />

      {showRequesterSelector ? (
        <FormSelect
          id="vr-requester"
          label="Solicitante"
          value={values.requestedByEmployeeId}
          onChange={(requestedByEmployeeId) =>
            onChange({ ...values, requestedByEmployeeId })
          }
          options={employees}
          allowEmpty
          emptyLabel="Yo (empleado vinculado)"
          hint="CLIENT_ADMIN/RECRUITER pueden solicitar en nombre de otro colaborador."
        />
      ) : null}

      {values.type === "EXISTING_POSITION" ? (
        <FormSelect
          id="vr-position"
          label="Cargo"
          required
          value={values.existingPositionId}
          onChange={(existingPositionId) =>
            onChange({ ...values, existingPositionId })
          }
          options={positions}
        />
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="vr-pos-name">Nombre del cargo *</Label>
            <Input
              id="vr-pos-name"
              value={values.requestedPositionName}
              onChange={(e) =>
                onChange({
                  ...values,
                  requestedPositionName: e.target.value,
                })
              }
              required
              maxLength={120}
            />
          </div>
          <FormSelect
            id="vr-area"
            label="Área"
            required
            value={values.requestedAreaId}
            onChange={(requestedAreaId) =>
              onChange({ ...values, requestedAreaId })
            }
            options={areas}
          />
          <FormSelect
            id="vr-level"
            label="Nivel"
            value={values.requestedJobLevelId}
            onChange={(requestedJobLevelId) =>
              onChange({ ...values, requestedJobLevelId })
            }
            options={jobLevels}
            allowEmpty
            emptyLabel="Sin nivel"
          />
        </>
      )}

      <div className="space-y-2">
        <Label htmlFor="vr-headcount">Headcount solicitado *</Label>
        <Input
          id="vr-headcount"
          type="number"
          min={1}
          step={1}
          value={values.requestedHeadcount}
          onChange={(e) =>
            onChange({ ...values, requestedHeadcount: e.target.value })
          }
          required
        />
        <p className="text-xs text-muted-foreground">
          Número de posiciones solicitadas.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="vr-justification">Justificación *</Label>
        <Textarea
          id="vr-justification"
          value={values.justification}
          onChange={(e) =>
            onChange({ ...values, justification: e.target.value })
          }
          required
          rows={4}
          maxLength={4000}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={values.generalManagerApprovalRequired}
          onCheckedChange={(checked) =>
            onChange({
              ...values,
              generalManagerApprovalRequired: checked === true,
            })
          }
        />
        Requiere aprobación de Gerencia General
      </label>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Guardando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
