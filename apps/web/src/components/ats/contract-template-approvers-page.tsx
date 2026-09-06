"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CargoOccupantListEditor } from "@/components/ats/cargo-occupant-list";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
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

export function ContractTemplateApproversPageClient() {
  const companyId = useCompanyId();
  const listQuery = useQuery({
    queryKey: atsKeys.contractTemplateApprovers(companyId),
    queryFn: () => atsApi.getContractTemplateApprovers(),
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
        title="No se pudieron cargar los aprobadores"
        description={getErrorMessage(listQuery.error, "Inténtalo de nuevo.")}
        onRetry={() => void listQuery.refetch()}
      />
    );
  }

  return (
    <ContractApproversForm
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

function ContractApproversForm({
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
        throw new Error("Cada aprobador debe tener un cargo.");
      }
      return atsApi.updateContractTemplateApprovers({
        steps: toPositionOccupantPayload(rows),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: atsKeys.contractTemplateApprovers(companyId),
      });
      setFormError(null);
      notifySuccess("Aprobadores de plantilla de contrato guardados");
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, "No se pudo guardar."));
      notifyError(error, "No se pudo guardar.");
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Aprobadores de contrato</h2>
        <p className="text-sm text-muted-foreground">
          Define quién aprueba el modelo de contrato antes del visto bueno de
          Talento Humano.
        </p>
      </div>
      <CargoOccupantListEditor
        rows={rows}
        onChange={setRows}
        positions={positions}
        rowLabel={(index) => `Aprobador ${index + 1}`}
        addLabel="Agregar aprobador"
        emptyHint="Agrega los aprobadores del modelo de contrato."
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
