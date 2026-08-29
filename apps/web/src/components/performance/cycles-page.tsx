"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CycleFormFields } from "@/components/performance/cycle-form-fields";
import { EntityEditorShell } from "@/components/organization/entity-editor-shell";
import { FormSelect } from "@/components/organization/form-select";
import { PaginationControls } from "@/components/organization/pagination-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
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
import { useCompanyId } from "@/hooks/use-company-id";
import { getErrorMessage } from "@/lib/api/errors";
import { goalsApi, goalKeys } from "@/lib/api/goals";
import { performanceApi, performanceKeys } from "@/lib/api/performance";
import { canEditCycleMetadata } from "@/lib/performance/activation";
import {
  buildCreateCyclePayload,
  buildUpdateCyclePayload,
  cycleEvaluatorWeightsAreValid,
  cycleFormFromPerformanceCycle,
  cycleGoalsCompositionIsValid,
  emptyCycleForm,
  type CycleFormState,
} from "@/lib/performance/cycle-form";
import {
  CYCLE_STATUS_LABELS,
  cycleStatusVariant,
} from "@/lib/performance/cycle-labels";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type {
  ListPerformanceCyclesParams,
  PerformanceCycle,
  PerformanceCycleStatus,
} from "@/types/performance";

function useCycleFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const params: ListPerformanceCyclesParams = {
    search: searchParams.get("search") ?? undefined,
    status:
      (searchParams.get("status") as PerformanceCycleStatus | null) ??
      undefined,
    page: Number(searchParams.get("page") ?? "1") || 1,
    limit: 20,
  };

  function setParams(next: Partial<ListPerformanceCyclesParams>) {
    const merged = { ...params, ...next };
    const sp = new URLSearchParams();
    if (merged.search) sp.set("search", merged.search);
    if (merged.status) sp.set("status", merged.status);
    if (merged.page && merged.page > 1) sp.set("page", String(merged.page));
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return { params, setParams };
}

export function CyclesPageClient() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const { params, setParams } = useCycleFilters();
  const [searchInput, setSearchInput] = useState(params.search ?? "");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PerformanceCycle | null>(null);
  const [form, setForm] = useState<CycleFormState>(emptyCycleForm());
  const [formError, setFormError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: performanceKeys.cycles(companyId, params),
    queryFn: () => performanceApi.listCycles(params),
  });

  const goalCyclesQuery = useQuery({
    queryKey: goalKeys.cycles(companyId, { limit: 100 }),
    queryFn: () => goalsApi.listCycles({ limit: 100 }),
    enabled: open,
  });

  const goalCycleOptions = (goalCyclesQuery.data?.items ?? []).map(
    (cycle) => ({
      value: cycle.id,
      label: `${cycle.name} (${cycle.startDate} → ${cycle.endDate})`,
    }),
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) {
        throw new Error("El nombre es obligatorio.");
      }
      if (!form.startDate || !form.endDate) {
        throw new Error("La apertura y el cierre del ciclo son obligatorios.");
      }
      if (!cycleEvaluatorWeightsAreValid(form)) {
        throw new Error(
          "La ponderación de evaluadores debe sumar exactamente 100%.",
        );
      }
      if (!cycleGoalsCompositionIsValid(form)) {
        throw new Error(
          "Revisa la composición: activa competencias o indica pesos de objetivos que no superen el rango.",
        );
      }
      if (editing) {
        return performanceApi.updateCycle(
          editing.id,
          buildUpdateCyclePayload(form),
        );
      }
      return performanceApi.createCycle(buildCreateCyclePayload(form));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: performanceKeys.all(companyId),
      });
      setOpen(false);
      setEditing(null);
      setForm(emptyCycleForm());
      setFormError(null);
      notifySuccess(editing ? "Ciclo actualizado" : "Ciclo creado");
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, "No se pudo guardar el ciclo."));
      notifyError(error, "No se pudo guardar el ciclo.");
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyCycleForm());
    setFormError(null);
    setOpen(true);
  }

  function openEdit(cycle: PerformanceCycle) {
    if (!canEditCycleMetadata(cycle.status)) return;
    setEditing(cycle);
    setForm(cycleFormFromPerformanceCycle(cycle));
    setFormError(null);
    setOpen(true);
  }

  const items = listQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ciclos"
        description="Ciclos de desempeño y su configuración."
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            Nuevo ciclo
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <form
          className="flex min-w-[16rem] flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setParams({ search: searchInput.trim() || undefined, page: 1 });
          }}
        >
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar ciclo…"
            aria-label="Buscar ciclos"
          />
          <Button type="submit" variant="secondary" aria-label="Buscar">
            <Search className="size-4" />
          </Button>
        </form>
        <FormSelect
          id="cycle-status"
          label="Estado"
          className="w-full sm:w-48"
          value={params.status ?? ""}
          onChange={(status) =>
            setParams({
              status: (status || undefined) as
                | PerformanceCycleStatus
                | undefined,
              page: 1,
            })
          }
          allowEmpty
          emptyLabel="Todos"
          options={Object.entries(CYCLE_STATUS_LABELS).map(
            ([value, label]) => ({ value, label }),
          )}
        />
      </div>

      {listQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : null}

      {listQuery.isError ? (
        <ErrorState
          title="No se pudieron cargar los ciclos"
          description={getErrorMessage(listQuery.error, "Error al cargar.")}
          onRetry={() => void listQuery.refetch()}
        />
      ) : null}

      {listQuery.isSuccess && items.length === 0 ? (
        <EmptyState
          title="Sin ciclos"
          description="Crea un ciclo de desempeño para comenzar."
          action={
            <Button type="button" onClick={openCreate}>
              Nuevo ciclo
            </Button>
          }
        />
      ) : null}

      {items.length > 0 ? (
        <>
          <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((cycle) => (
                  <TableRow key={cycle.id}>
                    <TableCell className="font-medium">{cycle.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {cycle.startDate} → {cycle.endDate}
                    </TableCell>
                    <TableCell>
                      <Badge variant={cycleStatusVariant(cycle.status)}>
                        {CYCLE_STATUS_LABELS[cycle.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/performance/cycles/${cycle.id}`}>
                            <Eye className="h-4 w-4" />
                            Ver
                          </Link>
                        </Button>
                        {canEditCycleMetadata(cycle.status) ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(cycle)}
                          >
                            <Pencil className="h-4 w-4" />
                            Editar
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {items.map((cycle) => (
              <div
                key={cycle.id}
                className="space-y-3 rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{cycle.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {cycle.startDate} → {cycle.endDate}
                    </p>
                  </div>
                  <Badge variant={cycleStatusVariant(cycle.status)}>
                    {CYCLE_STATUS_LABELS[cycle.status]}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/performance/cycles/${cycle.id}`}>Ver</Link>
                  </Button>
                  {canEditCycleMetadata(cycle.status) ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(cycle)}
                    >
                      Editar
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <PaginationControls
            page={listQuery.data?.page ?? 1}
            totalPages={listQuery.data?.totalPages ?? 1}
            total={listQuery.data?.total ?? 0}
            onPageChange={(page) => setParams({ page })}
          />
        </>
      ) : null}

      <EntityEditorShell
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Editar ciclo" : "Nuevo ciclo"}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            saveMutation.mutate();
          }}
        >
          <CycleFormFields
            form={form}
            setForm={setForm}
            goalCycleOptions={goalCycleOptions}
            goalCyclesLoading={goalCyclesQuery.isLoading}
            idPrefix="cycles"
            lockStartDate={editing != null}
          />
          <p className="text-xs text-muted-foreground">
            Las ventanas de fechas son opcionales; si usas una, debes indicar
            inicio y fin y deben estar dentro del periodo del ciclo. La apertura
            del ciclo no se puede modificar después de crearlo.
          </p>
          {formError ? (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      </EntityEditorShell>
    </div>
  );
}
