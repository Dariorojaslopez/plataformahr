"use client";

import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import Link from "next/link";
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
import { performanceApi, performanceKeys } from "@/lib/api/performance";
import { CYCLE_STATUS_LABELS } from "@/lib/performance/cycle-labels";
import {
  EVALUATION_STATUS_LABELS,
  EVALUATION_TYPE_LABELS,
  evaluationStatusVariant,
} from "@/lib/performance/evaluation-labels";
import {
  countMineEvaluations,
  formatMineSectionTitle,
} from "@/lib/performance/mine-grouping";
import {
  formatScorePercentage,
  mineEvaluationCta,
} from "@/lib/performance/response-workspace";
import type { MineEvaluation } from "@/types/performance";

function personName(row: {
  firstName: string;
  lastName: string;
}): string {
  return `${row.firstName} ${row.lastName}`.trim();
}

export function MyEvaluationsPageClient() {
  const companyId = useCompanyId();

  const mineQuery = useQuery({
    queryKey: performanceKeys.evaluationsMine(companyId),
    queryFn: () => performanceApi.listMineEvaluations(),
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

  const data = mineQuery.data ?? { self: [], asManager: [] };
  const counts = countMineEvaluations(data);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Mis evaluaciones"
        description="Autoevaluaciones y evaluaciones como líder en ciclos activos o cerrados."
      />

      {counts.total === 0 ? (
        <EmptyState
          title="Sin evaluaciones"
          description="Cuando te asignen a un ciclo, aparecerán aquí tus autoevaluaciones y las de tu equipo."
        />
      ) : (
        <>
          <EvaluationSection
            title="Mis autoevaluaciones"
            subtitle={formatMineSectionTitle("self", counts.self)}
            items={data.self}
            emptyDescription="No tienes autoevaluaciones asignadas."
            kind="self"
          />
          <EvaluationSection
            title="Evaluaciones como líder"
            subtitle={formatMineSectionTitle("asManager", counts.asManager)}
            items={data.asManager}
            emptyDescription="No tienes evaluaciones de equipo pendientes o asignadas."
            kind="asManager"
          />
        </>
      )}
    </div>
  );
}

function EvaluationSection({
  title,
  subtitle,
  items,
  emptyDescription,
  kind,
}: {
  title: string;
  subtitle: string;
  items: MineEvaluation[];
  emptyDescription: string;
  kind: "self" | "asManager";
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {items.length === 0 ? (
        <EmptyState title="Sin registros" description={emptyDescription} />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  {kind === "asManager" ? (
                    <TableHead>Colaborador</TableHead>
                  ) : null}
                  <TableHead>Ciclo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    {kind === "asManager" ? (
                      <TableCell className="font-medium">
                        {personName(item.employee)}
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.cycle.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {CYCLE_STATUS_LABELS[item.cycle.status]} ·{" "}
                          {item.cycle.startDate} → {item.cycle.endDate}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {EVALUATION_TYPE_LABELS[item.type]}
                    </TableCell>
                    <TableCell>
                      <Badge variant={evaluationStatusVariant(item.status)}>
                        {EVALUATION_STATUS_LABELS[item.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button type="button" variant="ghost" size="sm" asChild>
                        <Link href={`/performance/evaluations/${item.id}`}>
                          <Eye className="h-4 w-4" />
                          {mineEvaluationCta(item.status).label}
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {items.map((item) => (
              <div
                key={item.id}
                className="space-y-2 rounded-lg border border-border bg-card p-4"
              >
                {kind === "asManager" ? (
                  <p className="font-medium">{personName(item.employee)}</p>
                ) : null}
                <p className={kind === "asManager" ? "text-sm text-muted-foreground" : "font-medium"}>
                  {item.cycle.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {EVALUATION_TYPE_LABELS[item.type]}
                </p>
                <Badge variant={evaluationStatusVariant(item.status)}>
                  {EVALUATION_STATUS_LABELS[item.status]}
                </Badge>
                {item.status === "SUBMITTED" && item.scorePercentage ? (
                  <p className="text-sm text-muted-foreground">
                    Resultado: {formatScorePercentage(item.scorePercentage)}
                  </p>
                ) : null}
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link href={`/performance/evaluations/${item.id}`}>
                    {mineEvaluationCta(item.status).label}
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
