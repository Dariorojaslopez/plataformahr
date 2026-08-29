"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { PaginationControls } from "@/components/organization/pagination-controls";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FormSelect } from "@/components/organization/form-select";
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

function employeeLabel(row: { firstName: string; lastName: string; email: string }) {
  return `${row.firstName} ${row.lastName}`.trim() || row.email;
}

export function PopulationPageClient() {
  const companyId = useCompanyId();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Map<string, string>>(new Map());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cycleId, setCycleId] = useState("");

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

  const cyclesQuery = useQuery({
    queryKey: performanceKeys.cycles(companyId, { status: "ACTIVE", limit: 100 }),
    queryFn: () => performanceApi.listCycles({ status: "ACTIVE", limit: 100 }),
    enabled: dialogOpen,
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      const ids = [...selected.keys()];
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
    onSuccess: (assigned) => {
      notifySuccess(
        `${assigned} colaborador${assigned === 1 ? "" : "es"} asignado${assigned === 1 ? "" : "s"} al ciclo.`,
      );
      setDialogOpen(false);
      setSelected(new Map());
      setCycleId("");
    },
    onError: (error) =>
      notifyError(error, "No se pudo asignar la población al ciclo."),
  });

  const items = employeesQuery.data?.items ?? [];
  const pageIds = items.map((row) => row.id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const selectedCount = selected.size;
  const cycleOptions = useMemo(
    () =>
      (cyclesQuery.data?.items ?? []).map((cycle) => ({
        value: cycle.id,
        label: cycle.name,
      })),
    [cyclesQuery.data],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Seleccionar población a evaluar"
        description="Marca colaboradores activos y asígnalos a un ciclo de desempeño activo."
        actions={
          <Button
            type="button"
            disabled={selectedCount === 0}
            onClick={() => setDialogOpen(true)}
          >
            <Users className="h-4 w-4" />
            Asignar a un ciclo ({selectedCount})
          </Button>
        }
      />

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

      {employeesQuery.isLoading ? <Skeleton className="h-40 w-full" /> : null}
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
                      onCheckedChange={(value) => {
                        setSelected((prev) => {
                          const next = new Map(prev);
                          if (value) {
                            for (const row of items) {
                              next.set(row.id, employeeLabel(row));
                            }
                          } else {
                            for (const id of pageIds) next.delete(id);
                          }
                          return next;
                        });
                      }}
                      aria-label="Seleccionar página"
                    />
                  </TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Correo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(row.id)}
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
                  </TableRow>
                ))}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar al ciclo</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {selectedCount} persona{selectedCount === 1 ? "" : "s"} se
            incorporarán como participantes del ciclo elegido.
          </p>
          <FormSelect
            id="pop-cycle"
            label="Ciclo activo"
            value={cycleId}
            onChange={setCycleId}
            options={cycleOptions}
            placeholder="Seleccionar ciclo"
            required
          />
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!cycleId || assignMutation.isPending}
              onClick={() => assignMutation.mutate()}
            >
              {assignMutation.isPending ? "Asignando…" : "Asignar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
