"use client";

import { useQuery } from "@tanstack/react-query";
import { CargoOccupantListEditor } from "@/components/ats/cargo-occupant-list";
import { FormSelect } from "@/components/organization/form-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCompanyId } from "@/hooks/use-company-id";
import { atsApi, atsKeys } from "@/lib/api/ats";
import {
  isReplacementMotive,
  justificationRequired,
  replacementCoverOptions,
  VACANT_SLOT_PREFIX,
  type VacancyRequestFormValues,
} from "@/lib/ats/vacancy-request-form";
import {
  DEFAULT_VACANCY_HIRING_SLA_DAYS,
  minExpectedHiringDate,
  toDateOnlyIso,
} from "@/lib/ats/vacancy-request-sla";
import { describeVacancyRequesterField } from "@/lib/ats/vacancy-requester";
import { VACANCY_REQUEST_MOTIVE_LABELS } from "@/lib/ats/labels";
import type { VacancyRequestMotive } from "@/types/ats";

export type { VacancyRequestFormValues } from "@/lib/ats/vacancy-request-form";
export {
  emptyVacancyRequestForm,
  toCreateVacancyRequestPayload,
  toUpdateVacancyRequestPayload,
  vacancyRequestToForm,
} from "@/lib/ats/vacancy-request-form";

type Option = { value: string; label: string };

type VacancyRequestFormProps = {
  values: VacancyRequestFormValues;
  onChange: (values: VacancyRequestFormValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitting?: boolean;
  error?: string | null;
  positions: Option[];
  positionHeadcounts?: Record<string, number>;
  areas: Option[];
  jobLevels: Option[];
  employees: Option[];
  linkedEmployeeExists: boolean;
  canProxyRequester: boolean;
  slaDays?: number;
  submitLabel?: string;
  positionsHint?: string;
};

const MOTIVE_OPTIONS = (
  Object.entries(VACANCY_REQUEST_MOTIVE_LABELS) as Array<
    [VacancyRequestMotive, string]
  >
).map(([value, label]) => ({ value, label }));

export function VacancyRequestForm({
  values,
  onChange,
  onSubmit,
  onCancel,
  submitting,
  error,
  positions,
  positionHeadcounts = {},
  areas,
  jobLevels,
  employees,
  linkedEmployeeExists,
  canProxyRequester,
  slaDays = DEFAULT_VACANCY_HIRING_SLA_DAYS,
  submitLabel = "Guardar",
  positionsHint,
}: VacancyRequestFormProps) {
  const companyId = useCompanyId();
  const requesterField = describeVacancyRequesterField({
    linkedEmployeeExists,
    canProxyRequester,
  });
  const minHiringDate = toDateOnlyIso(minExpectedHiringDate(slaDays));
  const headcount = Number(values.requestedHeadcount) || 0;
  const structureHeadcount = values.existingPositionId
    ? positionHeadcounts[values.existingPositionId]
    : undefined;
  const needsJustification = justificationRequired({
    motive: values.motive,
    requestedHeadcount: headcount,
    positionHeadcount:
      values.motive === "NEW_POSITION" ? 0 : structureHeadcount,
  });

  const occupantsQuery = useQuery({
    queryKey: atsKeys.positionOccupants(companyId, values.existingPositionId),
    queryFn: () => atsApi.listPositionOccupants(values.existingPositionId),
    enabled:
      isReplacementMotive(values.motive) && Boolean(values.existingPositionId),
  });

  const occupantOptions = replacementCoverOptions(
    occupantsQuery.data ?? [],
    structureHeadcount,
  );
  const selectedCover =
    values.replacedEmployeeId ||
    occupantOptions.find((option) =>
      option.value.startsWith(VACANT_SLOT_PREFIX),
    )?.value ||
    "";

  function setMotive(motive: VacancyRequestMotive) {
    if (motive === "NEW_POSITION") {
      onChange({
        ...values,
        motive,
        existingPositionId: "",
        replacedEmployeeId: "",
      });
      return;
    }
    onChange({
      ...values,
      motive,
      requestedPositionName: "",
      requestedAreaId: "",
      requestedJobLevelId: "",
      replacedEmployeeId: isReplacementMotive(motive)
        ? values.replacedEmployeeId
        : "",
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
        id="vr-motive"
        label="Motivo"
        required
        value={values.motive}
        onChange={(value) => setMotive(value as VacancyRequestMotive)}
        options={MOTIVE_OPTIONS}
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

      {values.motive === "NEW_POSITION" ? (
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
      ) : (
        <>
          <FormSelect
            id="vr-position"
            label="Cargo"
            required
            value={values.existingPositionId}
            onChange={(existingPositionId) =>
              onChange({
                ...values,
                existingPositionId,
                replacedEmployeeId: "",
              })
            }
            options={positions}
            hint={
              positions.length === 0
                ? "No hay cargos que te reporten en el organigrama."
                : positionsHint
            }
          />
          {isReplacementMotive(values.motive) ? (
            <FormSelect
              id="vr-replaced"
              label="Plaza a cubrir"
              required
              value={selectedCover}
              onChange={(replacedEmployeeId) =>
                onChange({ ...values, replacedEmployeeId })
              }
              options={occupantOptions}
              hint={
                !values.existingPositionId
                  ? "Selecciona primero el cargo."
                  : occupantsQuery.isLoading
                    ? "Cargando ocupantes…"
                    : occupantOptions.length === 0
                      ? "Este cargo no tiene ocupantes ni plazas vacantes."
                      : "Elige a quién reemplazar o una posición vacante."
              }
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              Cubre una plaza vacante del cargo en la estructura. No reemplaza
              a un ocupante.
            </p>
          )}
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
        {structureHeadcount != null && values.motive !== "NEW_POSITION" ? (
          <p className="text-xs text-muted-foreground">
            Headcount del cargo en la estructura: {structureHeadcount}.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Número de plazas solicitadas.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="vr-hiring-date">Fecha esperada de contratación *</Label>
        <Input
          id="vr-hiring-date"
          type="date"
          min={minHiringDate}
          value={values.expectedHiringDate}
          onChange={(e) =>
            onChange({ ...values, expectedHiringDate: e.target.value })
          }
          required
        />
        <p className="text-xs text-muted-foreground">
          Según el SLA de la compañía ({slaDays} días), la fecha mínima es{" "}
          {minHiringDate}.
        </p>
      </div>

      {needsJustification ? (
        <div className="space-y-2">
          <Label htmlFor="vr-justification">
            Justificación
            {values.motive === "NEW_POSITION"
              ? " *"
              : " del aumento de headcount *"}
          </Label>
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
          {values.motive !== "NEW_POSITION" ? (
            <p className="text-xs text-muted-foreground">
              Obligatoria porque las plazas superan la estructura del cargo.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-sm font-medium">Niveles de aprobación</p>
        <p className="text-xs text-muted-foreground">
          Lista preestablecida. No se pueden modificar ni agregar aprobadores
          desde la solicitud.
        </p>
        <CargoOccupantListEditor
          rows={values.approvalSteps}
          onChange={() => undefined}
          positions={positions}
          rowLabel={(index) => `Nivel ${index + 1}`}
          addLabel="Agregar nivel"
          emptyHint="No hay niveles globales configurados. Configúralos en Aprobaciones."
          lockedHint="Nivel definido globalmente."
          readOnly
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
