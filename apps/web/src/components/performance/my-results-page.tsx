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
import {
  compositionSummaryLabel,
  isIntegratedComposition,
} from "@/lib/performance/composition-labels";
import { CYCLE_STATUS_LABELS } from "@/lib/performance/cycle-labels";
import { formatScorePercentage } from "@/lib/performance/response-workspace";
import {
  RESULT_STATUS_LABELS,
  resultStatusVariant,
} from "@/lib/performance/result-labels";

export function MyResultsPageClient() {
  const companyId = useCompanyId();

  const mineQuery = useQuery({
    queryKey: performanceKeys.resultsMine(companyId),
    queryFn: () => performanceApi.listMineResults(),
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
        title="No se pudieron cargar tus resultados"
        description={getErrorMessage(mineQuery.error, "Error al cargar.")}
        onRetry={() => void mineQuery.refetch()}
      />
    );
  }

  const items = mineQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mis resultados"
        description="Resultados de desempeño publicados para ti."
      />

      {items.length === 0 ? (
        <EmptyState
          title="Sin resultados publicados"
          description="Cuando RR.HH. publique tu resultado consolidado, lo verás aquí."
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ciclo</TableHead>
                  <TableHead>Overall</TableHead>
                  <TableHead>Composición</TableHead>
                  <TableHead>Autoevaluación</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.cycle.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {CYCLE_STATUS_LABELS[item.cycle.status]} ·{" "}
                          {item.cycle.startDate} → {item.cycle.endDate}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatScorePercentage(item.overallScore)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {compositionSummaryLabel(item.composition)}
                    </TableCell>
                    <TableCell>
                      {formatScorePercentage(item.selfScore)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={resultStatusVariant(item.status)}>
                        {RESULT_STATUS_LABELS[item.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button type="button" variant="ghost" size="sm" asChild>
                        <Link href={`/performance/my-results/${item.id}`}>
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
            {items.map((item) => (
              <div
                key={item.id}
                className="space-y-2 rounded-lg border border-border bg-card p-4"
              >
                <p className="font-medium">{item.cycle.name}</p>
                <p className="text-sm">
                  Overall: {formatScorePercentage(item.overallScore)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {compositionSummaryLabel(item.composition)}
                  {isIntegratedComposition(item.composition) &&
                  item.competencyScore != null
                    ? ` · Comp. ${formatScorePercentage(item.competencyScore)}`
                    : ""}
                  {isIntegratedComposition(item.composition) &&
                  item.goalsAchievement != null
                    ? ` · Cumpl. obj. ${formatScorePercentage(item.goalsAchievement)}`
                    : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  Autoevaluación: {formatScorePercentage(item.selfScore)}
                </p>
                <Badge variant={resultStatusVariant(item.status)}>
                  {RESULT_STATUS_LABELS[item.status]}
                </Badge>
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link href={`/performance/my-results/${item.id}`}>
                    Ver detalle
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
