"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { PaginationControls } from "@/components/organization/pagination-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCompanyId } from "@/hooks/use-company-id";
import { getErrorMessage } from "@/lib/api/errors";
import { organizationApi, orgKeys } from "@/lib/api/organization";
import { performanceApi, performanceKeys } from "@/lib/api/performance";
import {
  BULK_ASSIGN_MAX,
  buildBulkAssignPayload,
  chunkEmployeeIds,
} from "@/lib/performance/bulk-assign";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type { PerformanceCycleStatus } from "@/types/performance";

function employeeLabel(row: { firstName: string; lastName: string; email: string }) {
  return `${row.firstName} ${row.lastName}`.trim() || row.email;
}

type Props = {
  cycleId: string;
  cycleStatus: PerformanceCycleStatus;
};

export function CyclePopulationTab({ cycleId, cycleStatus }: Props) {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const canAssign = cycleStatus === "DRAFT" || cycleStatus === "ACTIVE";
  const canRemoveDraft = cycleStatus === "DRAFT";

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Map<string, string>>(new Map());

  const employeesQuery = useQuery({
    queryKey: orgKeys.employees(companyId, {
      status: "ACTIVE",
      search: search || undefined,
      page,
      limit: 20,
    }),
    queryFn: () =>
      organizationApi.listEmployees({
        status: "ACTIVE",
        search: search || undefined,
        page,
        limit: 20,
      }),
  });

  const assignedQuery = useQuery({
    queryKey: [
      ...performanceKeys.assignedEmployeeIds(companyId, cycleId),
      "rows",
    ],
    queryFn: () => performanceApi.listAllParticipants(cycleId),
  });

  const assignedIds = useMemo(
    () => new Set((assignedQuery.data ?? []).map((row) => row.employeeId)),
    [assignedQuery.data],
  );
  const participantByEmployeeId = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of assignedQuery.data ?? []) {
      map.set(item.employeeId, item.id);
    }
    return map;
  }, [assignedQuery.data]);

  async function invalidateAssignment() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: [...performanceKeys.all(companyId), "participants", cycleId],
      }),
      queryClient.invalidateQueries({
        queryKey: [
          ...performanceKeys.assignedEmployeeIds(companyId, cycleId),
        ],
      }),
      queryClient.invalidateQueries({
        queryKey: performanceKeys.cycle(companyId, cycleId),
      }),
      queryClient.invalidateQueries({
        queryKey: performanceKeys.analytics(companyId, cycleId),
      }),
    ]);
  }

  const assignMutation = useMutation({
    mutationFn: async () => {
      const ids = [...selected.keys()].filter((id) => !assignedIds.has(id));
      const chunks = chunkEmployeeIds(ids, BULK_ASSIGN_MAX);
      let assigned = 0;
      for (const chunk of chunks) {
        const result = await performanceApi.bulkAssignParticipants(
          cycleId,
          buildBulkAssignPayload(chunk),
        );
        assigned += result.created.length;
      }
      return assigned;
    },
    onSuccess: async (assigned) => {
      await invalidateAssignment();
      setSelected(new Map());
      notifySuccess(
        assigned === 1
          ? "1 colaborador asignado. Se cargaron las competencias de su nivel."
          : `${assigned} colaboradores asignados. Se cargaron las competencias de sus niveles.`,
      );
    },
    onError: (error) =>
      notifyError(error, "No se pudo asignar la población al ciclo."),
  });

  const removeMutation = useMutation({
    mutationFn: (participantId: string) =>
      performanceApi.removeDraftParticipant(cycleId, participantId),
    onSuccess: async () => {
      await invalidateAssignment();
      notifySuccess("Participante quitado del ciclo.");
    },
    onError: (error) => notifyError(error, "No se pudo quitar al participante."),
  });

  const items = employeesQuery.data?.items ?? [];
  const selectableIds = items
    .map((row) => row.id)
    .filter((id) => !assignedIds.has(id));
  const allPageSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const selectedNewCount = [...selected.keys()].filter(
    (id) => !assignedIds.has(id),
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Población a evaluar</h2>
          <p className="text-sm text-muted-foreground">
            {canAssign
              ? "Marca colaboradores activos. Al asignarlos se cargan las competencias del nivel de su cargo."
              : "La población solo se puede modificar en un ciclo en borrador o activo."}
          </p>
        </div>
        {canAssign ? (
          <Button
            type="button"
            disabled={selectedNewCount === 0 || assignMutation.isPending}
            onClick={() => assignMutation.mutate()}
          >
            <Users className="h-4 w-4" />
            Asignar al ciclo ({selectedNewCount})
          </Button>
        ) : null}
      </div>

      <form
        className="flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(searchInput.trim());
        }}
      >
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Buscar colaborador…"
          aria-label="Buscar colaboradores"
        />
        <Button type="submit" variant="secondary" aria-label="Buscar">
          <Search className="size-4" />
        </Button>
      </form>

      {employeesQuery.isLoading || assignedQuery.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : null}
      {employeesQuery.isError ? (
        <ErrorState
          title="No se pudieron cargar los colaboradores"
          description={getErrorMessage(employeesQuery.error, "Error")}
          onRetry={() => void employeesQuery.refetch()}
        />
      ) : null}
      {employeesQuery.isSuccess && items.length === 0 ? (
        <EmptyState
          title="Sin colaboradores activos"
          description="No hay personas activas para este filtro."
        />
      ) : null}

      {items.length > 0 ? (
        <>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allPageSelected}
                      disabled={!canAssign || selectableIds.length === 0}
                      onCheckedChange={(value) => {
                        setSelected((prev) => {
                          const next = new Map(prev);
                          if (value) {
                            for (const row of items) {
                              if (!assignedIds.has(row.id)) {
                                next.set(row.id, employeeLabel(row));
                              }
                            }
                          } else {
                            for (const id of selectableIds) next.delete(id);
                          }
                          return next;
                        });
                      }}
                      aria-label="Seleccionar página"
                    />
                  </TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Estado</TableHead>
                  {canRemoveDraft ? (
                    <TableHead className="text-right">Acciones</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => {
                  const assigned = assignedIds.has(row.id);
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Checkbox
                          checked={assigned || selected.has(row.id)}
                          disabled={!canAssign || assigned}
                          onCheckedChange={(value) => {
                            setSelected((prev) => {
                              const next = new Map(prev);
                              if (value) next.set(row.id, employeeLabel(row));
                              else next.delete(row.id);
                              return next;
                            });
                          }}
                          aria-label={`Seleccionar ${employeeLabel(row)}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {employeeLabel(row)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.email}
                      </TableCell>
                      <TableCell>
                        {assigned ? (
                          <Badge variant="secondary">Asignado</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Disponible
                          </span>
                        )}
                      </TableCell>
                      {canRemoveDraft ? (
                        <TableCell className="text-right">
                          {assigned ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={removeMutation.isPending}
                              onClick={() => {
                                const participantId = participantByEmployeeId.get(
                                  row.id,
                                );
                                if (participantId) {
                                  removeMutation.mutate(participantId);
                                }
                              }}
                            >
                              Quitar
                            </Button>
                          ) : null}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <PaginationControls
            page={employeesQuery.data?.page ?? 1}
            totalPages={employeesQuery.data?.totalPages ?? 1}
            total={employeesQuery.data?.total ?? 0}
            onPageChange={setPage}
          />
        </>
      ) : null}
    </div>
  );
}
