"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ResultGoalsBreakdown } from "@/components/performance/result-goals-breakdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyId } from "@/hooks/use-company-id";
import { getErrorMessage } from "@/lib/api/errors";
import { performanceApi, performanceKeys } from "@/lib/api/performance";
import {
  compositionSummaryLabel,
  isIntegratedComposition,
} from "@/lib/performance/composition-labels";
import { CYCLE_STATUS_LABELS } from "@/lib/performance/cycle-labels";
import { formatResultCompositionWeightLabel } from "@/lib/performance/result-composition-weights";
import { formatScorePercentage } from "@/lib/performance/response-workspace";
import {
  RESULT_STATUS_LABELS,
  managerIncludedLabel,
  resultStatusVariant,
} from "@/lib/performance/result-labels";
import type { PerformanceResultEmployeeDetail } from "@/types/performance";

/**
 * Employee-facing detail: never surface managerScore, even if the API
 * unexpectedly returns an admin-shaped payload.
 */
function employeeSafeDetail(
  data: Record<string, unknown>,
): {
  overallScore: string | null;
  selfScore: string | null;
  competencyScore: string | null;
  goalsAchievement: string | null;
  composition: PerformanceResultEmployeeDetail["composition"] | null;
  configuredCompetencyResultWeight: string | null;
  configuredGoalsResultWeight: string | null;
  goals: PerformanceResultEmployeeDetail["goals"];
  managerIncluded: boolean | null;
  effectiveSelfWeight: string | null;
  effectiveManagerWeight: string | null;
} {
  void ("managerScore" in data ? data.managerScore : undefined);

  const goals = Array.isArray(data.goals)
    ? (data.goals as PerformanceResultEmployeeDetail["goals"])
    : [];

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
    competencyScore:
      data.competencyScore == null
        ? null
        : typeof data.competencyScore === "string" ||
            typeof data.competencyScore === "number"
          ? String(data.competencyScore)
          : null,
    goalsAchievement:
      data.goalsAchievement == null
        ? null
        : typeof data.goalsAchievement === "string" ||
            typeof data.goalsAchievement === "number"
          ? String(data.goalsAchievement)
          : null,
    composition:
      data.composition === "COMPETENCY_ONLY" ||
      data.composition === "COMPETENCY_AND_GOALS"
        ? data.composition
        : null,
    configuredCompetencyResultWeight:
      typeof data.configuredCompetencyResultWeight === "string"
        ? data.configuredCompetencyResultWeight
        : null,
    configuredGoalsResultWeight:
      typeof data.configuredGoalsResultWeight === "string"
        ? data.configuredGoalsResultWeight
        : null,
    goals,
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

  const safe = employeeSafeDetail(data as unknown as Record<string, unknown>);
  const cycle = data.cycle;
  const integrated = isIntegratedComposition(safe.composition ?? undefined);

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

      {safe.composition ? (
        <p className="text-sm text-muted-foreground">
          Composición: {compositionSummaryLabel(safe.composition)}
        </p>
      ) : null}

      <div
        className={`grid gap-4 ${integrated ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"}`}
      >
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Resultado overall</p>
          <p className="mt-1 text-2xl font-semibold">
            {formatScorePercentage(safe.overallScore)}
          </p>
        </div>
        {integrated ? (
          <>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Competencias</p>
              <p className="mt-1 text-2xl font-semibold">
                {formatScorePercentage(safe.competencyScore)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Objetivos</p>
              <p className="mt-1 text-2xl font-semibold">
                {formatScorePercentage(safe.goalsAchievement)}
              </p>
            </div>
          </>
        ) : null}
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
            Ponderación efectiva (competencias): auto{" "}
            {formatScorePercentage(safe.effectiveSelfWeight)}, líder{" "}
            {formatScorePercentage(safe.effectiveManagerWeight)}.
          </p>
        ) : null}
        {integrated &&
        safe.configuredCompetencyResultWeight != null &&
        safe.configuredGoalsResultWeight != null ? (
          <p className="text-sm text-muted-foreground">
            Resultado general:{" "}
            {formatResultCompositionWeightLabel(
              safe.configuredCompetencyResultWeight,
              safe.configuredGoalsResultWeight,
            )}
          </p>
        ) : null}
        {"releasedAt" in data && data.releasedAt ? (
          <p className="text-sm text-muted-foreground">
            Publicado: {data.releasedAt}
          </p>
        ) : null}
      </section>

      {integrated ? (
        <section className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h2 className="text-base font-semibold">Tus objetivos</h2>
          <ResultGoalsBreakdown goals={safe.goals} />
        </section>
      ) : null}
    </div>
  );
}
