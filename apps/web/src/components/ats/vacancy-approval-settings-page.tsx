"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CargoOccupantListEditor } from "@/components/ats/cargo-occupant-list";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyId } from "@/hooks/use-company-id";
import { atsApi, atsKeys } from "@/lib/api/ats";
import { companyApi, companyKeys } from "@/lib/api/company";
import { getErrorMessage } from "@/lib/api/errors";
import { organizationApi, orgKeys } from "@/lib/api/organization";
import {
  emptyCargoOccupantRow,
  toPositionOccupantPayload,
  type CargoOccupantRow,
} from "@/lib/ats/position-occupant";
import { DEFAULT_VACANCY_HIRING_SLA_DAYS } from "@/lib/ats/vacancy-request-sla";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type { VacancyApprovalWorkflow } from "@/types/ats";

function toRows(workflow: VacancyApprovalWorkflow): CargoOccupantRow[] {
  return workflow.steps.map((step) => ({
    key: step.id,
    positionId: step.positionId ?? "",
    occupantId: step.specificEmployeeId ?? "",
    positionName: step.position?.name,
    occupantName: step.specificEmployee
      ? `${step.specificEmployee.firstName} ${step.specificEmployee.lastName}`.trim()
      : undefined,
  }));
}

export function VacancyApprovalSettingsPageClient() {
  const companyId = useCompanyId();
  const workflowQuery = useQuery({
    queryKey: atsKeys.vacancyApprovalWorkflow(companyId),
    queryFn: () => atsApi.getVacancyApprovalWorkflow(),
  });
  const companyQuery = useQuery({
    queryKey: companyKeys.current(companyId),
    queryFn: () => companyApi.getCurrent(),
  });
  const positionsQuery = useQuery({
    queryKey: orgKeys.positions(companyId),
    queryFn: () => organizationApi.listPositions(),
  });

  if (workflowQuery.isLoading || companyQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (workflowQuery.isError || !workflowQuery.data) {
    return (
      <ErrorState
        title="No se pudo cargar la configuración"
        description={getErrorMessage(
          workflowQuery.error,
          "Inténtalo de nuevo.",
        )}
        onRetry={() => void workflowQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-10">
      <HiringSlaForm
        key={`sla-${companyId}-${companyQuery.dataUpdatedAt}`}
        companyId={companyId}
        initialSlaDays={
          companyQuery.data?.vacancyHiringSlaDays ??
          DEFAULT_VACANCY_HIRING_SLA_DAYS
        }
      />
      <DefaultApprovalLevelsForm
        key={`${companyId}-${workflowQuery.dataUpdatedAt}`}
        companyId={companyId}
        workflow={workflowQuery.data}
        positions={(positionsQuery.data ?? [])
          .filter((item) => item.status === "ACTIVE")
          .map((item) => ({ value: item.id, label: item.name }))}
      />
    </div>
  );
}

function HiringSlaForm({
  companyId,
  initialSlaDays,
}: {
  companyId: string;
  initialSlaDays: number;
}) {
  const queryClient = useQueryClient();
  const [slaDays, setSlaDays] = useState(String(initialSlaDays));
  const [formError, setFormError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const value = Number(slaDays);
      if (!Number.isInteger(value) || value < 0 || value > 365) {
        throw new Error("El SLA debe ser un entero entre 0 y 365.");
      }
      return companyApi.updateAtsSettings({ vacancyHiringSlaDays: value });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: companyKeys.current(companyId),
      });
      setFormError(null);
      notifySuccess("SLA de contratación guardado");
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, "No se pudo guardar el SLA."));
      notifyError(error, "No se pudo guardar el SLA.");
    },
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="SLA de fecha de contratación"
        description="Días mínimos desde hoy para la fecha esperada de contratación en las solicitudes del líder."
      />
      <div className="max-w-xs space-y-2">
        <Label htmlFor="hiring-sla-days">Días de SLA</Label>
        <Input
          id="hiring-sla-days"
          type="number"
          min={0}
          max={365}
          step={1}
          value={slaDays}
          onChange={(event) => setSlaDays(event.target.value)}
        />
      </div>
      <Button
        type="button"
        disabled={saveMutation.isPending}
        onClick={() => saveMutation.mutate()}
      >
        {saveMutation.isPending ? "Guardando…" : "Guardar SLA"}
      </Button>
      {formError ? (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      ) : null}
    </div>
  );
}

function DefaultApprovalLevelsForm({
  companyId,
  workflow,
  positions,
}: {
  companyId: string;
  workflow: VacancyApprovalWorkflow;
  positions: Array<{ value: string; label: string }>;
}) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<CargoOccupantRow[]>(() => {
    const mapped = toRows(workflow);
    return mapped.length > 0 ? mapped : [emptyCargoOccupantRow()];
  });
  const [formError, setFormError] = useState<string | null>(null);
  const hasLegacySteps = useMemo(
    () =>
      workflow.steps.some(
        (step) => step.approverType !== "POSITION" && !step.positionId,
      ),
    [workflow.steps],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (
        rows.some((row) => !row.positionId) &&
        rows.some((row) => row.positionId)
      ) {
        throw new Error("Cada nivel debe tener un cargo.");
      }
      const payload = toPositionOccupantPayload(rows);
      return atsApi.updateVacancyApprovalWorkflow({
        enabled: payload.length > 0,
        steps: payload.map((step) => ({
          approverType: "POSITION" as const,
          positionId: step.positionId,
          specificEmployeeId: step.employeeId,
        })),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: atsKeys.vacancyApprovalWorkflow(companyId),
      });
      setFormError(null);
      notifySuccess("Niveles de aprobación guardados");
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, "No se pudo guardar."));
      notifyError(error, "No se pudo guardar.");
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Niveles de aprobación por defecto"
        description="Estos niveles se aplican a las solicitudes de proceso de selección. Usa el colaborador activo del cargo; si hay más de uno, elige el nombre."
      />
      {hasLegacySteps ? (
        <p className="text-sm text-muted-foreground">
          El flujo anterior usaba roles o el líder del solicitante. Vuelve a
          seleccionar el cargo de cada nivel para guardar el nuevo diseño.
        </p>
      ) : null}
      <CargoOccupantListEditor
        rows={rows}
        onChange={setRows}
        positions={positions}
        rowLabel={(index) => `Nivel ${index + 1}`}
        addLabel="Agregar nivel"
        emptyHint="Agrega al menos un nivel de aprobación."
      />
      <Button
        type="button"
        disabled={saveMutation.isPending}
        onClick={() => saveMutation.mutate()}
      >
        {saveMutation.isPending ? "Guardando…" : "Guardar"}
      </Button>
      {formError ? (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      ) : null}
    </div>
  );
}
