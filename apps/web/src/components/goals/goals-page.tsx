"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/components/auth/session-provider";
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
import { Switch } from "@/components/ui/switch";
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
import { companyApi, companyKeys } from "@/lib/api/company";
import { getErrorMessage } from "@/lib/api/errors";
import { goalKeys, goalsApi } from "@/lib/api/goals";
import {
  DIRECTION_LABELS,
  GOAL_STATUS_LABELS,
  METRIC_TYPE_LABELS,
  goalStatusVariant,
} from "@/lib/goals/labels";
import {
  buildOrganizationalGoalCreate,
  canManageOrganizationalGoals,
  emptyOrganizationalGoalForm,
  type OrganizationalGoalForm,
} from "@/lib/goals/organizational-form";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type {
  GoalMetricDirection,
  GoalMetricType,
  GoalStatus,
  ListGoalsParams,
} from "@/types/goals";

function useFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const params: ListGoalsParams = {
    search: searchParams.get("search") ?? undefined,
    status: (searchParams.get("status") as GoalStatus | null) ?? undefined,
    page: Number(searchParams.get("page") ?? "1") || 1,
    limit: 20,
  };
  function setParams(next: Partial<ListGoalsParams>) {
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

export function GoalsPageClient() {
  const companyId = useCompanyId();
  const router = useRouter();
  const { companyAccess } = useSession();
  const canManage = canManageOrganizationalGoals(companyAccess?.roleCodes);
  const { params, setParams } = useFilters();
  const [searchInput, setSearchInput] = useState(params.search ?? "");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<OrganizationalGoalForm>(
    emptyOrganizationalGoalForm,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: goalKeys.goals(companyId, { ...params, type: "COMPANY" }),
    queryFn: () => goalsApi.listOrganizationalGoals(params),
  });
  const companyQuery = useQuery({
    queryKey: companyKeys.current(companyId),
    queryFn: () => companyApi.getCurrent(),
  });
  const cyclesQuery = useQuery({
    queryKey: goalKeys.cycles(companyId, { limit: 100 }),
    queryFn: () => goalsApi.listCycles({ limit: 100 }),
    enabled: open && canManage,
  });

  const cascadeMutation = useMutation({
    mutationFn: (goalsCascadeEnabled: boolean) =>
      companyApi.updatePerformanceSettings({ goalsCascadeEnabled }),
    onSuccess: async (company) => {
      queryClient.setQueryData(companyKeys.current(companyId), company);
      notifySuccess(
        company.goalsCascadeEnabled
          ? "Cascadeo activado: los objetivos de compañía aplican a todos."
          : "Cascadeo desactivado.",
      );
    },
    onError: (error) => notifyError(error, "No se pudo guardar el cascadeo."),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = buildOrganizationalGoalCreate(form);
      const cycleId =
        "id" in payload.cycle
          ? payload.cycle.id
          : (
              await goalsApi.createCycle({
                name: payload.cycle.name,
                startDate: payload.cycle.startDate,
                endDate: payload.cycle.endDate,
              })
            ).id;
      const goal = await goalsApi.createGoal({
        ...payload.goal,
        cycleId,
      });
      await goalsApi.createKeyResult(goal.id, payload.keyResult);
      return goal;
    },
    onSuccess: async (goal) => {
      await queryClient.invalidateQueries({ queryKey: goalKeys.all(companyId) });
      setOpen(false);
      notifySuccess("Objetivo organizacional creado");
      router.push(`/goals/${goal.id}`);
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, "No se pudo crear."));
      notifyError(error, "No se pudo crear el objetivo.");
    },
  });

  const items = listQuery.data?.items ?? [];
  const cascadeOn = companyQuery.data?.goalsCascadeEnabled === true;
  const cycleOptions = (cyclesQuery.data?.items ?? [])
    .filter((cycle) => cycle.status === "DRAFT" || cycle.status === "ACTIVE")
    .map((cycle) => ({
      value: cycle.id,
      label: `${cycle.name} (${cycle.startDate} → ${cycle.endDate})`,
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Objetivos organizacionales"
        description={
          canManage
            ? "Crea objetivos de compañía con método de evaluación y meta. Después carga los resultados en el detalle."
            : "Objetivos de compañía visibles para todas las personas."
        }
        actions={
          canManage ? (
            <Button
              type="button"
              onClick={() => {
                setForm(emptyOrganizationalGoalForm());
                setFormError(null);
                setOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Nuevo objetivo
            </Button>
          ) : null
        }
      />

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Label htmlFor="cascade-switch">Cascadeo</Label>
          <p className="text-sm text-muted-foreground">
            Si está activo, estos objetivos aplican a todas las personas. Por
            defecto permanece apagado.
          </p>
        </div>
        <Switch
          id="cascade-switch"
          checked={cascadeOn}
          disabled={!canManage || cascadeMutation.isPending}
          onCheckedChange={(checked) => cascadeMutation.mutate(checked)}
          aria-label="Activar cascadeo de objetivos organizacionales"
        />
      </section>

      <form
        className="flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setParams({ search: searchInput.trim() || undefined, page: 1 });
        }}
      >
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Buscar por título…"
          aria-label="Buscar objetivos organizacionales"
        />
        <Button type="submit" variant="secondary" aria-label="Buscar">
          <Search className="size-4" />
        </Button>
      </form>

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
          title="Sin objetivos organizacionales"
          description={
            canManage
              ? "Crea el primero con periodo, método de evaluación y meta."
              : "Cuando existan objetivos de compañía, aparecerán aquí."
          }
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
                  <TableHead>Estado</TableHead>
                  <TableHead>KR</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.title}</TableCell>
                    <TableCell>{row.cycle.name}</TableCell>
                    <TableCell>
                      <Badge variant={goalStatusVariant(row.status)}>
                        {GOAL_STATUS_LABELS[row.status]}
                      </Badge>
                    </TableCell>
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
                <p className="text-sm text-muted-foreground">{row.cycle.name}</p>
                <Badge variant={goalStatusVariant(row.status)}>
                  {GOAL_STATUS_LABELS[row.status]}
                </Badge>
                <Button type="button" variant="ghost" size="sm" asChild>
                  <Link href={`/goals/${row.id}`}>Ver</Link>
                </Button>
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
        title="Nuevo objetivo organizacional"
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setFormError(null);
            try {
              buildOrganizationalGoalCreate(form);
            } catch (error) {
              setFormError(
                error instanceof Error ? error.message : "Revisa el formulario.",
              );
              return;
            }
            createMutation.mutate();
          }}
        >
          <FormSelect
            id="org-goal-cycle"
            label="Periodo"
            value={form.cycleId}
            onChange={(cycleId) => setForm((f) => ({ ...f, cycleId }))}
            options={cycleOptions}
            allowEmpty
            emptyLabel={
              cyclesQuery.isLoading ? "Cargando periodos…" : "Crear un periodo nuevo"
            }
          />
          {!form.cycleId ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-3">
                <Label htmlFor="org-goal-cycle-name">Nombre del periodo</Label>
                <Input
                  id="org-goal-cycle-name"
                  value={form.newCycleName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, newCycleName: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-goal-cycle-start">Inicio</Label>
                <Input
                  id="org-goal-cycle-start"
                  type="date"
                  value={form.newCycleStartDate}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      newCycleStartDate: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="org-goal-cycle-end">Cierre</Label>
                <Input
                  id="org-goal-cycle-end"
                  type="date"
                  value={form.newCycleEndDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, newCycleEndDate: e.target.value }))
                  }
                />
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="org-goal-title">Título *</Label>
            <Input
              id="org-goal-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-goal-desc">Descripción</Label>
            <Textarea
              id="org-goal-desc"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </div>

          <FormSelect
            id="org-goal-metric"
            label="Método de evaluación"
            value={form.metricType}
            onChange={(metricType) =>
              setForm((f) => ({
                ...f,
                metricType: metricType as GoalMetricType,
                ...(metricType === "BOOLEAN"
                  ? { direction: "", targetValue: "", startValue: "" }
                  : {
                      direction: f.direction || "INCREASE",
                      targetBoolean: true,
                    }),
              }))
            }
            options={Object.entries(METRIC_TYPE_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
          />

          {form.metricType === "BOOLEAN" ? (
            <FormSelect
              id="org-goal-bool"
              label="Meta"
              value={form.targetBoolean ? "yes" : "no"}
              onChange={(value) =>
                setForm((f) => ({ ...f, targetBoolean: value === "yes" }))
              }
              options={[
                { value: "yes", label: "Cumplir" },
                { value: "no", label: "No cumplir" },
              ]}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <FormSelect
                id="org-goal-direction"
                label="Sentido"
                value={form.direction}
                onChange={(direction) =>
                  setForm((f) => ({
                    ...f,
                    direction: direction as GoalMetricDirection,
                  }))
                }
                options={Object.entries(DIRECTION_LABELS).map(
                  ([value, label]) => ({ value, label }),
                )}
              />
              <div className="space-y-2">
                <Label htmlFor="org-goal-target">Meta *</Label>
                <Input
                  id="org-goal-target"
                  type="number"
                  step="0.01"
                  value={form.targetValue}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, targetValue: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-goal-start">Valor inicial</Label>
                <Input
                  id="org-goal-start"
                  type="number"
                  step="0.01"
                  value={form.startValue}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, startValue: e.target.value }))
                  }
                />
              </div>
              {form.metricType === "CURRENCY" ? (
                <div className="space-y-2">
                  <Label htmlFor="org-goal-currency">Moneda</Label>
                  <Input
                    id="org-goal-currency"
                    value={form.currencyCode}
                    maxLength={3}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        currencyCode: e.target.value.toUpperCase(),
                      }))
                    }
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="org-goal-unit">Unidad</Label>
                  <Input
                    id="org-goal-unit"
                    value={form.unit}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, unit: e.target.value }))
                    }
                    placeholder={
                      form.metricType === "PERCENTAGE" ? "%" : "Opcional"
                    }
                  />
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            La carga de resultados se hace en el detalle del objetivo, con el
            periodo activo: registra el avance contra la meta.
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
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creando…" : "Crear"}
            </Button>
          </div>
        </form>
      </EntityEditorShell>
    </div>
  );
}
