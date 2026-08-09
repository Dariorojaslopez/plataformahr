"use client";

import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCompanyId } from "@/hooks/use-company-id";
import { getErrorMessage } from "@/lib/api/errors";
import { performanceApi, performanceKeys } from "@/lib/api/performance";
import {
  formatAverageScore,
  formatRate,
  sortBreakdownByResultCount,
  submissionProgressLabel,
} from "@/lib/performance/analytics-view";
import type { OrgBreakdownRow, ScoreDistributionBucket } from "@/types/performance";

function KpiCard(props: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{props.label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{props.value}</p>
      {props.hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{props.hint}</p>
      ) : null}
    </div>
  );
}

function DistributionBars({ buckets }: { buckets: ScoreDistributionBucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <ul className="space-y-3" aria-label="Distribución de resultados">
      {buckets.map((bucket) => {
        const width = `${(bucket.count / max) * 100}%`;
        return (
          <li key={bucket.key} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span>{bucket.label}</span>
              <span className="text-muted-foreground">
                {bucket.count} ({formatRate(bucket.percentage)})
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded bg-muted"
              role="img"
              aria-label={`${bucket.label}: ${bucket.count} resultados, ${formatRate(bucket.percentage)}`}
            >
              <div
                className="h-full rounded bg-foreground/80"
                style={{ width }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function BreakdownTable({
  rows,
  emptyTitle,
}: {
  rows: OrgBreakdownRow[];
  emptyTitle: string;
}) {
  const sorted = sortBreakdownByResultCount(rows);
  if (sorted.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description="Cuando existan resultados calculados, verás el desglose aquí."
      />
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Resultados</TableHead>
            <TableHead>Promedio</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row) => (
            <TableRow key={`${row.id ?? "null"}-${row.name}`}>
              <TableCell>{row.name}</TableCell>
              <TableCell>{row.resultCount}</TableCell>
              <TableCell>{formatAverageScore(row.averageScore)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function CycleAnalyticsTab({ cycleId }: { cycleId: string }) {
  const companyId = useCompanyId();
  const analyticsQuery = useQuery({
    queryKey: performanceKeys.analytics(companyId, cycleId),
    queryFn: () => performanceApi.getCycleAnalytics(cycleId),
  });

  if (analyticsQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (analyticsQuery.isError) {
    return (
      <ErrorState
        title="No se pudo cargar el resumen"
        description={getErrorMessage(analyticsQuery.error, "Error al cargar.")}
        onRetry={() => void analyticsQuery.refetch()}
      />
    );
  }

  const data = analyticsQuery.data;
  if (!data) return null;

  const { participants, evaluations, results } = data;
  const pendingEligible = participants.activeParticipants;

  if (participants.totalParticipants === 0) {
    return (
      <EmptyState
        title="Sin participantes"
        description="Asigna colaboradores al ciclo para ver avance y métricas de resultados."
      />
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        Las métricas administrativas de resultados incluyen resultados calculados
        y publicados.
      </p>

      <section className="space-y-3" aria-label="Indicadores del ciclo">
        <h2 className="text-lg font-semibold">Indicadores</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Participantes"
            value={String(participants.totalParticipants)}
          />
          <KpiCard
            label="Completados"
            value={String(participants.completedParticipants)}
            hint={`Tasa ${formatRate(participants.completionRate)} (sin excluidos)`}
          />
          <KpiCard
            label="Pendientes"
            value={String(pendingEligible)}
            hint="Participantes ACTIVE elegibles"
          />
          <KpiCard
            label="Excluidos"
            value={String(participants.excludedParticipants)}
          />
          <KpiCard
            label="Resultado promedio"
            value={formatAverageScore(results.averageScore)}
            hint={
              results.averageScore == null
                ? "El ciclo aún no tiene resultados calculados."
                : undefined
            }
          />
          <KpiCard
            label="Resultados calculados"
            value={String(results.calculatedResults)}
          />
          <KpiCard
            label="Resultados publicados"
            value={String(results.releasedResults)}
            hint={`Publicación ${formatRate(results.releasedRate)}`}
          />
        </div>
      </section>

      <section className="space-y-3" aria-label="Avance de evaluaciones">
        <h2 className="text-lg font-semibold">Avance de evaluaciones</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-border p-4">
            <p className="font-medium">Autoevaluaciones</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {submissionProgressLabel(evaluations.self)}
            </p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="font-medium">Evaluaciones del líder</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {submissionProgressLabel(evaluations.manager)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              El total de líder puede ser menor si no había manager directo al
              asignar.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3" aria-label="Avance de resultados">
        <h2 className="text-lg font-semibold">Avance de resultados</h2>
        <p className="text-sm text-muted-foreground">
          Calculados: {results.calculatedResults} · Publicados:{" "}
          {results.releasedResults} · Tasa de publicación:{" "}
          {results.releasedResults} / {results.totalResults} (
          {formatRate(results.releasedRate)})
        </p>
        {results.totalResults === 0 ? (
          <EmptyState
            title="Sin resultados"
            description="El ciclo aún no tiene resultados calculados."
          />
        ) : null}
      </section>

      <section className="space-y-3" aria-label="Distribución de scores">
        <h2 className="text-lg font-semibold">Distribución</h2>
        <p className="text-sm text-muted-foreground">
          Rangos estadísticos neutrales (sin etiquetas cualitativas).
        </p>
        {results.totalResults === 0 ? (
          <EmptyState
            title="Sin distribución"
            description="El ciclo aún no tiene resultados calculados."
          />
        ) : (
          <DistributionBars buckets={data.distribution} />
        )}
      </section>

      <section className="space-y-3" aria-label="Desglose organizacional">
        <h2 className="text-lg font-semibold">Desglose organizacional</h2>
        <p className="text-sm text-muted-foreground">
          Basado en el snapshot organizacional al calcular el resultado.
        </p>
        <Tabs defaultValue="area">
          <TabsList>
            <TabsTrigger value="area">Por área</TabsTrigger>
            <TabsTrigger value="position">Por cargo</TabsTrigger>
            <TabsTrigger value="bu">Por unidad de negocio</TabsTrigger>
          </TabsList>
          <TabsContent value="area" className="mt-3">
            <BreakdownTable
              rows={data.byArea}
              emptyTitle="Sin desglose por área"
            />
          </TabsContent>
          <TabsContent value="position" className="mt-3">
            <BreakdownTable
              rows={data.byPosition}
              emptyTitle="Sin desglose por cargo"
            />
          </TabsContent>
          <TabsContent value="bu" className="mt-3">
            <BreakdownTable
              rows={data.byBusinessUnit}
              emptyTitle="Sin desglose por unidad de negocio"
            />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
