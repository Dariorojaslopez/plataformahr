"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
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
import { goalKeys, goalsApi } from "@/lib/api/goals";
import {
  GOAL_CYCLE_STATUS_LABELS,
  GOAL_STATUS_LABELS,
  GOAL_TYPE_LABELS,
  cycleStatusVariant,
  goalStatusVariant,
} from "@/lib/goals/labels";
import { notifyError, notifySuccess } from "@/lib/ui/notify";

export function GoalCycleDetailPageClient() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const params = useParams<{ id: string }>();
  const cycleId = params.id;

  const cycleQuery = useQuery({
    queryKey: goalKeys.cycle(companyId, cycleId),
    queryFn: () => goalsApi.getCycle(cycleId),
  });

  const goalsQuery = useQuery({
    queryKey: goalKeys.goals(companyId, { cycleId, limit: 100 }),
    queryFn: () => goalsApi.listGoals({ cycleId, limit: 100 }),
  });

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: goalKeys.all(companyId) });
  }

  const activateMutation = useMutation({
    mutationFn: () => goalsApi.activateCycle(cycleId),
    onSuccess: async () => {
      await invalidate();
      notifySuccess("Periodo activado");
    },
    onError: (e) => notifyError(e, "No se pudo activar."),
  });
  const closeMutation = useMutation({
    mutationFn: () => goalsApi.closeCycle(cycleId),
    onSuccess: async () => {
      await invalidate();
      notifySuccess("Periodo cerrado");
    },
    onError: (e) => notifyError(e, "No se pudo cerrar."),
  });
  const cancelMutation = useMutation({
    mutationFn: () => goalsApi.cancelCycle(cycleId),
    onSuccess: async () => {
      await invalidate();
      notifySuccess("Periodo cancelado");
    },
    onError: (e) => notifyError(e, "No se pudo cancelar."),
  });

  if (cycleQuery.isLoading) return <Skeleton className="h-40 w-full" />;
  if (cycleQuery.isError) {
    return (
      <ErrorState
        title="No se pudo cargar el periodo"
        description={getErrorMessage(cycleQuery.error, "Error")}
        onRetry={() => void cycleQuery.refetch()}
      />
    );
  }
  const cycle = cycleQuery.data!;
  const goals = goalsQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link href="/goals/cycles">
            <ArrowLeft className="h-4 w-4" />
            Periodos
          </Link>
        </Button>
      </div>
      <PageHeader
        title={cycle.name}
        description={`${cycle.startDate} → ${cycle.endDate}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {cycle.status === "DRAFT" ? (
              <Button
                type="button"
                disabled={activateMutation.isPending}
                onClick={() => {
                  if (confirm("¿Activar este periodo?"))
                    activateMutation.mutate();
                }}
              >
                {activateMutation.isPending ? "Activando…" : "Activar"}
              </Button>
            ) : null}
            {cycle.status === "ACTIVE" ? (
              <Button
                type="button"
                variant="secondary"
                disabled={closeMutation.isPending}
                onClick={() => {
                  if (confirm("¿Cerrar periodo? No debe haber objetivos ACTIVE."))
                    closeMutation.mutate();
                }}
              >
                {closeMutation.isPending ? "Cerrando…" : "Cerrar"}
              </Button>
            ) : null}
            {cycle.status === "DRAFT" || cycle.status === "ACTIVE" ? (
              <Button
                type="button"
                variant="destructive"
                disabled={cancelMutation.isPending}
                onClick={() => {
                  if (confirm("¿Cancelar este periodo?"))
                    cancelMutation.mutate();
                }}
              >
                {cancelMutation.isPending ? "Cancelando…" : "Cancelar"}
              </Button>
            ) : null}
            <Button type="button" asChild>
              <Link href={`/goals?cycleId=${cycleId}`}>
                <Plus className="h-4 w-4" />
                Crear objetivo
              </Link>
            </Button>
          </div>
        }
      />
      <Badge variant={cycleStatusVariant(cycle.status)}>
        {GOAL_CYCLE_STATUS_LABELS[cycle.status]}
      </Badge>
      {cycle.description ? (
        <p className="text-sm text-muted-foreground">{cycle.description}</p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Activar el periodo no activa objetivos DRAFT automáticamente.
      </p>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Objetivos del periodo</h2>
        {goalsQuery.isLoading ? <Skeleton className="h-20 w-full" /> : null}
        {goalsQuery.isError ? (
          <ErrorState
            title="No se pudieron cargar los objetivos"
            description={getErrorMessage(goalsQuery.error, "Error")}
            onRetry={() => void goalsQuery.refetch()}
          />
        ) : null}
        {goalsQuery.isSuccess && goals.length === 0 ? (
          <EmptyState
            title="Sin objetivos"
            description="Crea objetivos DRAFT y actívalos cuando el periodo esté ACTIVE."
          />
        ) : null}
        {goals.length > 0 ? (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {goals.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell>{g.title}</TableCell>
                    <TableCell>{GOAL_TYPE_LABELS[g.type]}</TableCell>
                    <TableCell>
                      <Badge variant={goalStatusVariant(g.status)}>
                        {GOAL_STATUS_LABELS[g.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button type="button" variant="ghost" size="sm" asChild>
                        <Link href={`/goals/${g.id}`}>Abrir</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
