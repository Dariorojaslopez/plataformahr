"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyId } from "@/hooks/use-company-id";
import { getErrorMessage } from "@/lib/api/errors";
import { performanceApi, performanceKeys } from "@/lib/api/performance";
import {
  CYCLE_STATUS_LABELS,
  cycleStatusVariant,
} from "@/lib/performance/cycle-labels";
import {
  groupMineEvaluationsByCycle,
  mineCycleCta,
  mineCycleHref,
  type MineCycleGroup,
} from "@/lib/performance/mine-cycles";

export function MyEvaluationsPageClient() {
  const companyId = useCompanyId();

  const mineQuery = useQuery({
    queryKey: performanceKeys.evaluationsMine(companyId),
    queryFn: () => performanceApi.listMineEvaluations(),
  });
  const notificationsQuery = useQuery({
    queryKey: performanceKeys.notifications(companyId),
    queryFn: () => performanceApi.listPerformanceNotifications(),
  });

  if (mineQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (mineQuery.isError) {
    return (
      <ErrorState
        title="No se pudieron cargar tus evaluaciones"
        description={getErrorMessage(mineQuery.error, "Error al cargar.")}
        onRetry={() => void mineQuery.refetch()}
      />
    );
  }

  const groups = groupMineEvaluationsByCycle(mineQuery.data);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Mis evaluaciones"
        description="Ciclos a los que fuiste invitado. En un ciclo activo puedes continuar la fase actual; en ciclos inactivos solo visualizas."
      />

      {(notificationsQuery.data?.items.length ?? 0) > 0 ? (
        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium">Notificaciones</p>
          <ul className="space-y-2">
            {notificationsQuery.data?.items.slice(0, 5).map((item) => (
              <li key={item.id} className="text-sm">
                <p className={item.readAt ? "text-muted-foreground" : "font-medium"}>
                  {item.title}
                </p>
                <p className="text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {groups.length === 0 ? (
        <EmptyState
          title="Sin evaluaciones"
          description="Cuando te inviten a un ciclo, aparecerán aquí con el nombre del ciclo y la fase en la que te encuentras."
        />
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <CycleInviteCard key={group.cycleId} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}

function CycleInviteCard({ group }: { group: MineCycleGroup }) {
  const cta = mineCycleCta(group);
  const href = mineCycleHref(group.cycleId);
  const taskCount = group.self.length + group.others.length;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>{group.name}</CardTitle>
          <CardDescription>
            {group.startDate} → {group.endDate}
            {taskCount > 0
              ? ` · ${taskCount} ${taskCount === 1 ? "evaluación" : "evaluaciones"} asignadas`
              : null}
          </CardDescription>
        </div>
        <Badge variant={cycleStatusVariant(group.status)}>
          {CYCLE_STATUS_LABELS[group.status]}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Fase actual</p>
          <p className="mt-1 text-sm font-medium">
            {group.currentPhase
              ? group.currentPhase.label
              : group.editable
                ? "Fuera de ventana de fase"
                : "Sin fase activa"}
          </p>
          {group.currentPhase ? (
            <p className="text-xs text-muted-foreground">
              {group.currentPhase.startDate} → {group.currentPhase.endDate}
            </p>
          ) : null}
          <p className="mt-2 text-sm text-muted-foreground">
            {group.editable
              ? "Puedes editar solo la fase actual. Las fases anteriores se consultan en solo lectura."
              : "Ciclo inactivo: solo visualización."}
          </p>
        </div>
        <Button type="button" asChild>
          <Link href={href}>
            {cta.label}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
