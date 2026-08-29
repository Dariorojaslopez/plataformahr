"use client";

import { CargoOccupantListEditor } from "@/components/ats/cargo-occupant-list";
import { FormSelect } from "@/components/organization/form-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { extraApprovalRows, requestPlanToApprovalRows } from "@/lib/ats/approval-plan";
import { toPositionOccupantPayload, type CargoOccupantRow } from "@/lib/ats/position-occupant";
import { describeVacancyRequesterField } from "@/lib/ats/vacancy-requester";
import type {
  CreateVacancyRequestInput,
  UpdateVacancyRequestInput,
  VacancyApprovalWorkflow,
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
  approvalSteps: CargoOccupantRow[];
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
  approvalSteps: [],
});

export function vacancyRequestToForm(
  request: VacancyRequest,
  workflow?: VacancyApprovalWorkflow,
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
    approvalSteps: requestPlanToApprovalRows(request, workflow),
  };
}

export function toCreateVacancyRequestPayload(
  values: VacancyRequestFormValues,
): CreateVacancyRequestInput {
  const headcount = Number(values.requestedHeadcount);
  const extras = toPositionOccupantPayload(extraApprovalRows(values.approvalSteps));
  const base: CreateVacancyRequestInput = {
    type: values.type,
    requestedHeadcount: headcount,
    justification: values.justification.trim(),
    extraApprovalSteps: extras,
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
  linkedEmployeeExists: boolean;
  canProxyRequester: boolean;
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
  linkedEmployeeExists,
  canProxyRequester,
  submitLabel = "Guardar",
}: VacancyRequestFormProps) {
  const requesterField = describeVacancyRequesterField({
    linkedEmployeeExists,
    canProxyRequester,
  });

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

      {requesterField.blocked ? (
        <p className="text-sm text-destructive" role="alert">
          {requesterField.blockedMessage}
        </p>
      ) : null}

      {requesterField.showSelector ? (
        <FormSelect
          id="vr-requester"
          label="Solicitante"
          value={values.requestedByEmployeeId}
          onChange={(requestedByEmployeeId) =>
            onChange({ ...values, requestedByEmployeeId })
          }
          options={employees}
          required={requesterField.requesterRequired}
          allowEmpty={requesterField.allowSelfOption}
          emptyLabel={requesterField.emptyLabel ?? undefined}
          hint={requesterField.hint ?? undefined}
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
        <Label htmlFor="vr-headcount">Plazas solicitadas *</Label>
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
          Número de plazas solicitadas.
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

      <div className="space-y-2">
        <p className="text-sm font-medium">Niveles de aprobación</p>
        <p className="text-xs text-muted-foreground">
          Los niveles definidos globalmente no se pueden editar. Puedes agregar
          niveles extra para esta solicitud.
        </p>
        <CargoOccupantListEditor
          rows={values.approvalSteps}
          onChange={(approvalSteps) => onChange({ ...values, approvalSteps })}
          positions={positions}
          rowLabel={(index) => `Nivel ${index + 1}`}
          addLabel="Agregar nivel"
          emptyHint="No hay niveles globales. Agrega los que apliquen a esta solicitud."
          lockedHint="Nivel definido globalmente. No se puede editar ni eliminar."
        />
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting || requesterField.blocked}>
          {submitting ? "Guardando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
