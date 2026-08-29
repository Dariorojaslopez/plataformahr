"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { CargoOccupantListEditor } from "@/components/ats/cargo-occupant-list";
import { FormSelect } from "@/components/organization/form-select";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyId } from "@/hooks/use-company-id";
import { atsApi, atsKeys } from "@/lib/api/ats";
import { getErrorMessage } from "@/lib/api/errors";
import { organizationApi, orgKeys } from "@/lib/api/organization";
import {
  toPositionOccupantPayload,
  type CargoOccupantRow,
} from "@/lib/ats/position-occupant";
import { formatEmployeeName } from "@/lib/ats/labels";
import { notifyError, notifySuccess } from "@/lib/ui/notify";

type ProcessKind = "approvals" | "evaluators";

export function ActiveProcessesPageClient() {
  const companyId = useCompanyId();
  const [kind, setKind] = useState<ProcessKind>("approvals");
  const [processId, setProcessId] = useState("");

  const processesQuery = useQuery({
    queryKey: atsKeys.activeProcesses(companyId),
    queryFn: () => atsApi.listActiveProcesses(),
  });
  const positionsQuery = useQuery({
    queryKey: orgKeys.positions(companyId),
    queryFn: () => organizationApi.listPositions(),
  });

  const processes = processesQuery.data?.items ?? [];
  const positions = (positionsQuery.data ?? [])
    .filter((item) => item.status === "ACTIVE")
    .map((item) => ({ value: item.id, label: item.name }));

  if (processesQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (processesQuery.isError) {
    return (
      <ErrorState
        title="No se pudieron cargar los procesos"
        description={getErrorMessage(
          processesQuery.error,
          "Inténtalo de nuevo.",
        )}
        onRetry={() => void processesQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Procesos activos"
        description="Ajusta niveles de aprobación o evaluadores de un proceso ya lanzado, solo si aún no hay decisión o evaluación."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormSelect
          id="active-kind"
          label="Qué vas a editar"
          value={kind}
          onChange={(value) => {
            setKind(value as ProcessKind);
            setProcessId("");
          }}
          options={[
            { value: "approvals", label: "Niveles de aprobación" },
            { value: "evaluators", label: "Evaluadores" },
          ]}
        />
        <FormSelect
          id="active-process"
          label="Proceso activo"
          value={processId}
          onChange={setProcessId}
          allowEmpty
          emptyLabel="Seleccionar proceso"
          options={processes.map((item) => ({
            value: item.id,
            label: item.title,
          }))}
        />
      </div>
      {processId ? (
        <ActiveProcessEditor
          companyId={companyId}
          processId={processId}
          kind={kind}
          positions={positions}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Selecciona un proceso activo para ver su configuración.
        </p>
      )}
    </div>
  );
}

function ActiveProcessEditor({
  companyId,
  processId,
  kind,
  positions,
}: {
  companyId: string;
  processId: string;
  kind: ProcessKind;
  positions: Array<{ value: string; label: string }>;
}) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const approvalsQuery = useQuery({
    queryKey: atsKeys.activeProcessApprovals(companyId, processId),
    queryFn: () => atsApi.getActiveProcessApprovals(processId),
    enabled: kind === "approvals",
  });
  const evaluatorsQuery = useQuery({
    queryKey: atsKeys.activeProcessEvaluators(companyId, processId),
    queryFn: () => atsApi.getActiveProcessEvaluators(processId),
    enabled: kind === "evaluators",
  });
  const detailQuery = kind === "approvals" ? approvalsQuery : evaluatorsQuery;

  const rows = useMemo<CargoOccupantRow[]>(() => {
    if (kind === "approvals") {
      return (approvalsQuery.data?.steps ?? []).map((step) => ({
        key: step.id,
        positionId: step.positionId ?? "",
        occupantId: step.approverEmployeeId ?? "",
        locked: step.locked,
        positionName: step.position?.name,
        occupantName: formatEmployeeName(step.approverEmployee),
      }));
    }
    return (evaluatorsQuery.data?.steps ?? []).map((step) => ({
      key: step.id,
      positionId: step.positionId,
      occupantId: step.employeeId,
      locked: step.locked,
      positionName: step.position?.name,
      occupantName: formatEmployeeName(step.employee),
    }));
  }, [approvalsQuery.data, evaluatorsQuery.data, kind]);

  const [draft, setDraft] = useState<CargoOccupantRow[] | null>(null);
  useEffect(() => {
    setDraft(null);
  }, [processId, kind]);
  const visibleRows = draft ?? rows;
  const canEditApprovals =
    kind !== "approvals" || approvalsQuery.data?.status === "PENDING_APPROVAL";
  const editableRows = visibleRows.filter((row) => !row.locked);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (visibleRows.some((row) => !row.locked && !row.positionId)) {
        throw new Error("Cada fila editable debe tener un cargo.");
      }
      const payload = {
        steps: toPositionOccupantPayload(
          kind === "evaluators" ? visibleRows : editableRows,
        ),
      };
      return kind === "approvals"
        ? atsApi.updateActiveProcessApprovals(processId, payload)
        : atsApi.updateActiveProcessEvaluators(processId, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: atsKeys.activeProcesses(companyId),
      });
      await queryClient.invalidateQueries({
        queryKey:
          kind === "approvals"
            ? atsKeys.activeProcessApprovals(companyId, processId)
            : atsKeys.activeProcessEvaluators(companyId, processId),
      });
      setDraft(null);
      setFormError(null);
      notifySuccess("Proceso actualizado");
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, "No se pudo guardar."));
      notifyError(error, "No se pudo guardar.");
    },
  });

  if (detailQuery.isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }
  if (detailQuery.isError || !detailQuery.data) {
    return (
      <ErrorState
        title="No se pudo cargar el proceso"
        description={getErrorMessage(detailQuery.error, "Inténtalo de nuevo.")}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      {!canEditApprovals ? (
        <p className="text-sm text-muted-foreground">
          Los niveles de este proceso ya no se pueden cambiar porque no está en
          aprobación.
        </p>
      ) : null}
      <CargoOccupantListEditor
        rows={visibleRows}
        onChange={setDraft}
        positions={positions}
        readOnly={!canEditApprovals}
        rowLabel={(index) =>
          kind === "approvals" ? `Nivel ${index + 1}` : `Evaluador ${index + 1}`
        }
        addLabel={
          kind === "approvals" ? "Agregar nivel" : "Agregar evaluador"
        }
        emptyHint={
          kind === "approvals"
            ? "Este proceso no tiene niveles pendientes."
            : "Este proceso no tiene evaluadores."
        }
      />
      {canEditApprovals ? (
        <Button
          type="button"
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? "Guardando…" : "Guardar"}
        </Button>
      ) : null}
      {formError ? (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      ) : null}
    </div>
  );
}
