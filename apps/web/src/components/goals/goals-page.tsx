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
import { organizationApi, orgKeys } from "@/lib/api/organization";
import {
  GOAL_STATUS_LABELS,
  GOAL_TYPE_LABELS,
  goalStatusVariant,
} from "@/lib/goals/labels";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type {
  GoalStatus,
  GoalType,
  ListGoalsParams,
} from "@/types/goals";

function useFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const params: ListGoalsParams = {
    search: searchParams.get("search") ?? undefined,
    cycleId: searchParams.get("cycleId") ?? undefined,
    status: (searchParams.get("status") as GoalStatus | null) ?? undefined,
    type: (searchParams.get("type") as GoalType | null) ?? undefined,
    areaId: searchParams.get("areaId") ?? undefined,
    page: Number(searchParams.get("page") ?? "1") || 1,
    limit: 20,
  };
  function setParams(next: Partial<ListGoalsParams>) {
    const merged = { ...params, ...next };
    const sp = new URLSearchParams();
    if (merged.search) sp.set("search", merged.search);
    if (merged.cycleId) sp.set("cycleId", merged.cycleId);
    if (merged.status) sp.set("status", merged.status);
    if (merged.type) sp.set("type", merged.type);
    if (merged.areaId) sp.set("areaId", merged.areaId);
    if (merged.page && merged.page > 1) sp.set("page", String(merged.page));
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }
  return { params, setParams };
}

export function GoalsPageClient() {
  const companyId = useCompanyId();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { params, setParams } = useFilters();
  const [searchInput, setSearchInput] = useState(params.search ?? "");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    cycleId: params.cycleId ?? "",
    title: "",
    description: "",
    type: "INDIVIDUAL" as GoalType,
    areaId: "",
    weight: "",
  });
  const [formError, setFormError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: goalKeys.goals(companyId, params),
    queryFn: () => goalsApi.listGoals(params),
  });
  const cyclesQuery = useQuery({
    queryKey: goalKeys.cycles(companyId, { limit: 100 }),
    queryFn: () => goalsApi.listCycles({ limit: 100 }),
  });
  const areasQuery = useQuery({
    queryKey: orgKeys.areas(companyId),
    queryFn: () => organizationApi.listAreas(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      goalsApi.createGoal({
        cycleId: form.cycleId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        type: form.type,
        areaId: form.type === "AREA" ? form.areaId : null,
        weight: form.weight === "" ? null : Number(form.weight),
      }),
    onSuccess: async (goal) => {
      await queryClient.invalidateQueries({ queryKey: goalKeys.all(companyId) });
      setOpen(false);
      notifySuccess("Objetivo creado");
      router.push(`/goals/${goal.id}`);
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, "No se pudo crear."));
      notifyError(error, "No se pudo crear el objetivo.");
    },
  });

  const items = listQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Objetivos"
        description="Administra objetivos individuales, de área y de compañía."
        actions={
          <Button
            type="button"
            onClick={() => {
              setFormError(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Nuevo objetivo
          </Button>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
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
            placeholder="Buscar por título…"
            aria-label="Buscar objetivos"
          />
          <Button type="submit" variant="secondary" aria-label="Buscar">
            <Search className="size-4" />
          </Button>
        </form>
        <FormSelect
          id="g-cycle"
          label="Periodo"
          className="w-full sm:w-56"
          value={params.cycleId ?? ""}
          onChange={(cycleId) =>
            setParams({ cycleId: cycleId || undefined, page: 1 })
          }
          allowEmpty
          emptyLabel="Todos"
          options={(cyclesQuery.data?.items ?? []).map((c) => ({
            value: c.id,
            label: c.name,
          }))}
        />
        <FormSelect
          id="g-status"
          label="Estado"
          className="w-full sm:w-40"
          value={params.status ?? ""}
          onChange={(status) =>
            setParams({
              status: (status || undefined) as GoalStatus | undefined,
              page: 1,
            })
          }
          allowEmpty
          emptyLabel="Todos"
          options={Object.entries(GOAL_STATUS_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        <FormSelect
          id="g-type"
          label="Tipo"
          className="w-full sm:w-40"
          value={params.type ?? ""}
          onChange={(type) =>
            setParams({
              type: (type || undefined) as GoalType | undefined,
              page: 1,
            })
          }
          allowEmpty
          emptyLabel="Todos"
          options={Object.entries(GOAL_TYPE_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
      </div>

      {listQuery.isLoading ? <Skeleton className="h-24 w-full" /> : null}
      {listQuery.isError ? (
        <ErrorState
          title="No se pudieron cargar los objetivos"
          description={getErrorMessage(listQuery.error, "Error")}
          onRetry={() => void listQuery.refetch()}
        />
      ) : null}
      {listQuery.isSuccess && items.length === 0 ? (
        <EmptyState
          title="Sin objetivos"
          description="Crea un borrador, configura Key Results y responsables, luego actívalo."
        />
      ) : null}

      {items.length > 0 ? (
        <>
          <div className="hidden overflow-hidden rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>KR</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.title}</TableCell>
                    <TableCell>{row.cycle.name}</TableCell>
                    <TableCell>{GOAL_TYPE_LABELS[row.type]}</TableCell>
                    <TableCell>
                      <Badge variant={goalStatusVariant(row.status)}>
                        {GOAL_STATUS_LABELS[row.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.area?.name ?? "—"}</TableCell>
                    <TableCell>{row.keyResultCount}</TableCell>
                    <TableCell className="text-right">
                      <Button type="button" variant="ghost" size="sm" asChild>
                        <Link href={`/goals/${row.id}`}>
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
              <div
                key={row.id}
                className="space-y-2 rounded-lg border border-border bg-card p-4"
              >
                <p className="font-medium">{row.title}</p>
                <p className="text-sm text-muted-foreground">
                  {row.cycle.name} · {GOAL_TYPE_LABELS[row.type]}
                  {row.area?.name ? ` · ${row.area.name}` : ""}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={goalStatusVariant(row.status)}>
                    {GOAL_STATUS_LABELS[row.status]}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    KR: {row.keyResultCount}
                  </span>
                </div>
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link href={`/goals/${row.id}`}>
                    <Eye className="h-4 w-4" />
                    Ver
                  </Link>
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
        title="Nuevo objetivo"
      >
        <div className="space-y-3">
          <FormSelect
            id="create-cycle"
            label="Periodo"
            value={form.cycleId}
            onChange={(cycleId) => setForm((f) => ({ ...f, cycleId }))}
            options={(cyclesQuery.data?.items ?? []).map((c) => ({
              value: c.id,
              label: c.name,
            }))}
          />
          <div className="space-y-1">
            <Label htmlFor="g-title">Título</Label>
            <Input
              id="g-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="g-desc">Descripción</Label>
            <Textarea
              id="g-desc"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </div>
          <FormSelect
            id="create-type"
            label="Tipo"
            value={form.type}
            onChange={(type) =>
              setForm((f) => ({ ...f, type: type as GoalType }))
            }
            options={Object.entries(GOAL_TYPE_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          {form.type === "AREA" ? (
            <FormSelect
              id="create-area"
              label="Área"
              value={form.areaId}
              onChange={(areaId) => setForm((f) => ({ ...f, areaId }))}
              options={(areasQuery.data ?? []).map((a) => ({
                value: a.id,
                label: a.name,
              }))}
            />
          ) : null}
          <div className="space-y-1">
            <Label htmlFor="g-weight">Peso (opcional)</Label>
            <Input
              id="g-weight"
              type="number"
              min={0}
              max={100}
              value={form.weight}
              onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
            />
          </div>
          {form.type === "INDIVIDUAL" ? (
            <p className="text-sm text-muted-foreground">
              Los objetivos individuales requieren al menos un responsable antes
              de activar.
            </p>
          ) : null}
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
            Crear borrador
          </Button>
        </div>
      </EntityEditorShell>
    </div>
  );
}
