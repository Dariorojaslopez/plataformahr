"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { EntityEditorShell } from "@/components/organization/entity-editor-shell";
import { FormSelect } from "@/components/organization/form-select";
import { PaginationControls } from "@/components/organization/pagination-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { useCompanyId } from "@/hooks/use-company-id";
import { getErrorMessage } from "@/lib/api/errors";
import { goalKeys, goalsApi } from "@/lib/api/goals";
import {
  GOAL_CYCLE_STATUS_LABELS,
  cycleStatusVariant,
} from "@/lib/goals/labels";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type { GoalCycleStatus, ListGoalCyclesParams } from "@/types/goals";

function useFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const params: ListGoalCyclesParams = {
    search: searchParams.get("search") ?? undefined,
    status:
      (searchParams.get("status") as GoalCycleStatus | null) ?? undefined,
    page: Number(searchParams.get("page") ?? "1") || 1,
    limit: 20,
  };
  function setParams(next: Partial<ListGoalCyclesParams>) {
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

export function GoalCyclesPageClient() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const { params, setParams } = useFilters();
  const [searchInput, setSearchInput] = useState(params.search ?? "");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    startDate: "",
    endDate: "",
  });
  const [formError, setFormError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: goalKeys.cycles(companyId, params),
    queryFn: () => goalsApi.listCycles(params),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      goalsApi.createCycle({
        name: form.name.trim(),
        description: form.description.trim() || null,
        startDate: form.startDate,
        endDate: form.endDate,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: goalKeys.all(companyId) });
      setOpen(false);
      notifySuccess("Periodo creado");
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, "No se pudo crear."));
      notifyError(error, "No se pudo crear el periodo.");
    },
  });

  const items = listQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Periodos de objetivos"
        description="Define periodos (ciclos) para organizar objetivos y Key Results."
        actions={
          <Button
            type="button"
            onClick={() => {
              setForm({ name: "", description: "", startDate: "", endDate: "" });
              setFormError(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Nuevo periodo
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
            placeholder="Buscar periodo…"
            aria-label="Buscar periodos"
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
              status: (status || undefined) as GoalCycleStatus | undefined,
              page: 1,
            })
          }
          allowEmpty
          emptyLabel="Todos"
          options={Object.entries(GOAL_CYCLE_STATUS_LABELS).map(
            ([value, label]) => ({
              value,
              label,
            }),
          )}
        />
      </div>

      {listQuery.isLoading ? <Skeleton className="h-24 w-full" /> : null}
      {listQuery.isError ? (
        <ErrorState
          title="No se pudieron cargar los periodos"
          description={getErrorMessage(listQuery.error, "Error")}
          onRetry={() => void listQuery.refetch()}
        />
      ) : null}
      {listQuery.isSuccess && items.length === 0 ? (
        <EmptyState
          title="Sin periodos"
          description="Crea un periodo DRAFT para empezar a definir objetivos."
        />
      ) : null}

      {items.length > 0 ? (
        <>
          <div className="hidden overflow-hidden rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Fechas</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Objetivos</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>
                      {row.startDate} → {row.endDate}
                    </TableCell>
                    <TableCell>
                      <Badge variant={cycleStatusVariant(row.status)}>
                        {GOAL_CYCLE_STATUS_LABELS[row.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.goalCount}</TableCell>
                    <TableCell className="text-right">
                      <Button type="button" variant="ghost" size="sm" asChild>
                        <Link href={`/goals/cycles/${row.id}`}>
                          <Eye className="h-4 w-4" />
                          Ver
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-3 md:hidden">
            {items.map((row) => (
              <div key={row.id} className="space-y-2 rounded-lg border p-4">
                <p className="font-medium">{row.name}</p>
                <p className="text-sm text-muted-foreground">
                  {row.startDate} → {row.endDate}
                </p>
                <Badge variant={cycleStatusVariant(row.status)}>
                  {GOAL_CYCLE_STATUS_LABELS[row.status]}
                </Badge>
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link href={`/goals/cycles/${row.id}`}>Ver detalle</Link>
                </Button>
              </div>
            ))}
          </div>
          <PaginationControls
            page={params.page ?? 1}
            totalPages={listQuery.data?.totalPages ?? 1}
            total={listQuery.data?.total ?? 0}
            onPageChange={(page) => setParams({ page })}
          />
        </>
      ) : null}

      <EntityEditorShell
        open={open}
        onOpenChange={setOpen}
        title="Nuevo periodo"
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="gc-name">Nombre</Label>
            <Input
              id="gc-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gc-desc">Descripción</Label>
            <Textarea
              id="gc-desc"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="gc-start">Inicio</Label>
              <Input
                id="gc-start"
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startDate: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="gc-end">Fin</Label>
              <Input
                id="gc-end"
                type="date"
                value={form.endDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, endDate: e.target.value }))
                }
              />
            </div>
          </div>
          {formError ? (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          ) : null}
          <Button
            type="button"
            disabled={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Crear
          </Button>
        </div>
      </EntityEditorShell>
    </div>
  );
}
