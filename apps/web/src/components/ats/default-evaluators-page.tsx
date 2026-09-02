"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { formatEmployeeName } from "@/lib/ats/labels";
import { notifyError, notifySuccess } from "@/lib/ui/notify";

export function DefaultEvaluatorsPageClient() {
  const companyId = useCompanyId();
  const listQuery = useQuery({
    queryKey: atsKeys.evaluatorDefaults(companyId),
    queryFn: () => atsApi.getEvaluatorDefaults(),
  });
  const positionsQuery = useQuery({
    queryKey: orgKeys.positions(companyId),
    queryFn: () => organizationApi.listPositions(),
  });

  if (listQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (listQuery.isError || !listQuery.data) {
    return (
      <ErrorState
        title="No se pudieron cargar los evaluadores"
        description={getErrorMessage(listQuery.error, "Inténtalo de nuevo.")}
        onRetry={() => void listQuery.refetch()}
      />
    );
  }

  return (
    <DefaultEvaluatorsForm
      key={`${companyId}-${listQuery.dataUpdatedAt}`}
      companyId={companyId}
      initialRows={
        listQuery.data.steps.length > 0
          ? listQuery.data.steps.map((step) => ({
              key: step.id,
              positionId: step.positionId,
              occupantId: step.employeeId ?? "",
              positionName: step.position?.name,
              occupantName: formatEmployeeName(step.employee),
            }))
          : [emptyCargoOccupantRow()]
      }
      positions={(positionsQuery.data ?? [])
        .filter((item) => item.status === "ACTIVE")
        .map((item) => ({ value: item.id, label: item.name }))}
    />
  );
}

function DefaultEvaluatorsForm({
  companyId,
  initialRows,
  positions,
}: {
  companyId: string;
  initialRows: CargoOccupantRow[];
  positions: Array<{ value: string; label: string }>;
}) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<CargoOccupantRow[]>(initialRows);
  const [formError, setFormError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (
        rows.some((row) => !row.positionId) &&
        rows.some((row) => row.positionId)
      ) {
        throw new Error("Cada evaluador debe tener un cargo.");
      }
      return atsApi.updateEvaluatorDefaults({
        steps: toPositionOccupantPayload(rows),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: atsKeys.evaluatorDefaults(companyId),
      });
      setFormError(null);
      notifySuccess("Evaluadores por defecto guardados");
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, "No se pudo guardar."));
      notifyError(error, "No se pudo guardar.");
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Evaluadores por defecto"
        description="Se copian al enviar un proceso de selección. Usa el colaborador activo del cargo; si hay más de uno, elige el nombre."
      />
      <CargoOccupantListEditor
        rows={rows}
        onChange={setRows}
        positions={positions}
        rowLabel={(index) => `Evaluador ${index + 1}`}
        addLabel="Agregar evaluador"
        emptyHint="Agrega los evaluadores que aplican por defecto."
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
