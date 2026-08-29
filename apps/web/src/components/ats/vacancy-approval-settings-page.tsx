"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CargoOccupantListEditor } from "@/components/ats/cargo-occupant-list";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyId } from "@/hooks/use-company-id";
import { atsApi, atsKeys } from "@/lib/api/ats";
import { getErrorMessage } from "@/lib/api/errors";
import { organizationApi, orgKeys } from "@/lib/api/organization";
import {
  emptyCargoOccupantRow,
  toPositionOccupantPayload,
  type CargoOccupantRow,
} from "@/lib/ats/position-occupant";
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
  const positionsQuery = useQuery({
    queryKey: orgKeys.positions(companyId),
    queryFn: () => organizationApi.listPositions(),
  });

  if (workflowQuery.isLoading) {
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
    <DefaultApprovalLevelsForm
      key={`${companyId}-${workflowQuery.dataUpdatedAt}`}
      companyId={companyId}
      workflow={workflowQuery.data}
      positions={(positionsQuery.data ?? [])
        .filter((item) => item.status === "ACTIVE")
        .map((item) => ({ value: item.id, label: item.name }))}
    />
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
        description="Estos niveles se aplican a las solicitudes de proceso de selección. Si un cargo tiene más de un ocupante, elige el nombre."
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
