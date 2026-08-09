"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyId } from "@/hooks/use-company-id";
import { getErrorMessage } from "@/lib/api/errors";
import { performanceApi, performanceKeys } from "@/lib/api/performance";
import { CYCLE_STATUS_LABELS } from "@/lib/performance/cycle-labels";
import { formatScorePercentage } from "@/lib/performance/response-workspace";
import {
  RESULT_STATUS_LABELS,
  managerIncludedLabel,
  resultStatusVariant,
} from "@/lib/performance/result-labels";

/**
 * Employee-facing detail: never surface managerScore, even if the API
 * unexpectedly returns an admin-shaped payload.
 */
function employeeSafeScores(data: Record<string, unknown>): {
  overallScore: string | null;
  selfScore: string | null;
  managerIncluded: boolean | null;
  effectiveSelfWeight: string | null;
  effectiveManagerWeight: string | null;
} {
  // Explicitly ignore managerScore if present on the object.
  void ("managerScore" in data ? data.managerScore : undefined);

  return {
    overallScore:
      typeof data.overallScore === "string" ||
      typeof data.overallScore === "number"
        ? String(data.overallScore)
        : null,
    selfScore:
      data.selfScore == null
        ? null
        : typeof data.selfScore === "string" ||
            typeof data.selfScore === "number"
          ? String(data.selfScore)
          : null,
    managerIncluded:
      typeof data.managerIncluded === "boolean" ? data.managerIncluded : null,
    effectiveSelfWeight:
      typeof data.effectiveSelfWeight === "string"
        ? data.effectiveSelfWeight
        : null,
    effectiveManagerWeight:
      typeof data.effectiveManagerWeight === "string"
        ? data.effectiveManagerWeight
        : null,
  };
}

export function MyResultDetailPageClient() {
  const companyId = useCompanyId();
  const params = useParams<{ id: string }>();
  const resultId = params.id;

  const detailQuery = useQuery({
    queryKey: performanceKeys.result(companyId, resultId),
    queryFn: () => performanceApi.getResult(resultId),
  });

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (detailQuery.isError) {
    return (
      <ErrorState
        title="No se pudo cargar tu resultado"
        description={getErrorMessage(detailQuery.error, "Error al cargar.")}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  const data = detailQuery.data;
  if (!data) return null;

  const safe = employeeSafeScores(data as unknown as Record<string, unknown>);
  const cycle = data.cycle;

  return (
    <div className="space-y-6">
      <div>
        <Button type="button" variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/performance/my-results">
            <ArrowLeft className="h-4 w-4" />
            Volver a mis resultados
          </Link>
        </Button>
        <PageHeader
          title={cycle.name}
          description={`${CYCLE_STATUS_LABELS[cycle.status]} · ${cycle.startDate} → ${cycle.endDate}`}
          actions={
            <Badge variant={resultStatusVariant(data.status)}>
              {RESULT_STATUS_LABELS[data.status]}
            </Badge>
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Resultado overall</p>
          <p className="mt-1 text-2xl font-semibold">
            {formatScorePercentage(safe.overallScore)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Tu autoevaluación</p>
          <p className="mt-1 text-2xl font-semibold">
            {formatScorePercentage(safe.selfScore)}
          </p>
        </div>
      </div>

      <section className="space-y-2 rounded-lg border border-border bg-card p-4">
        {safe.managerIncluded != null ? (
          <p className="text-sm">{managerIncludedLabel(safe.managerIncluded)}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            El consolidado puede incluir o no evaluación de líder según lo
            configurado en el ciclo.
          </p>
        )}
        {safe.effectiveSelfWeight != null &&
        safe.effectiveManagerWeight != null ? (
          <p className="text-sm text-muted-foreground">
            Ponderación efectiva: auto{" "}
            {formatScorePercentage(safe.effectiveSelfWeight)}, líder{" "}
            {formatScorePercentage(safe.effectiveManagerWeight)}.
          </p>
        ) : null}
        {"releasedAt" in data && data.releasedAt ? (
          <p className="text-sm text-muted-foreground">
            Publicado: {data.releasedAt}
          </p>
        ) : null}
      </section>
    </div>
  );
}
