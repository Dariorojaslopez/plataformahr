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
  resultStatusVariant,
} from "@/lib/performance/result-labels";
import type { PerformanceResultAdminDetail } from "@/types/performance";

function employeeName(row: {
  firstName: string;
  lastName: string;
}): string {
  return `${row.firstName} ${row.lastName}`.trim();
}

function isAdminDetail(
  data: Awaited<ReturnType<typeof performanceApi.getResult>>,
): data is PerformanceResultAdminDetail {
  return data.view === "admin";
}

export function ResultDetailPageClient() {
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
        title="No se pudo cargar el resultado"
        description={getErrorMessage(detailQuery.error, "Error al cargar.")}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  const data = detailQuery.data;
  if (!data) return null;

  const admin = isAdminDetail(data) ? data : null;
  const integrated = isIntegratedComposition(
    admin?.composition ?? ("composition" in data ? data.composition : undefined),
  );

  return (
    <div className="space-y-6">
      <div>
        <Button type="button" variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/performance/results">
            <ArrowLeft className="h-4 w-4" />
            Volver a resultados
          </Link>
        </Button>
        <PageHeader
          title={
            admin
              ? employeeName(admin.employee)
              : "Detalle de resultado"
          }
          description={
            admin
              ? `${admin.cycle.name} · ${CYCLE_STATUS_LABELS[admin.cycle.status]}`
              : data.cycle.name
          }
          actions={
            <Badge variant={resultStatusVariant(data.status)}>
              {RESULT_STATUS_LABELS[data.status]}
            </Badge>
          }
        />
      </div>

      {admin ? (
        <p className="text-sm text-muted-foreground">
          Composición: {compositionSummaryLabel(admin.composition)}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ScoreCard
          label="Overall"
          value={formatScorePercentage(data.overallScore)}
          emphasize
        />
        {integrated && admin ? (
          <>
            <ScoreCard
              label="Competencias"
              value={formatScorePercentage(admin.competencyScore)}
            />
            <ScoreCard
              label="Objetivos"
              value={formatScorePercentage(admin.goalsAchievement)}
            />
          </>
        ) : null}
        <ScoreCard
          label="Autoevaluación"
          value={formatScorePercentage(
            admin ? admin.selfScore : "selfScore" in data ? data.selfScore : null,
          )}
        />
        <ScoreCard
          label="Evaluación de líder"
          value={
            admin
              ? formatScorePercentage(admin.managerScore)
              : "—"
          }
        />
      </div>

      {admin ? (
        <section className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h2 className="text-base font-semibold">Ponderación</h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <WeightRow
              label="Evaluadores (auto / líder)"
              value={`${formatScorePercentage(admin.configuredSelfWeight)} / ${formatScorePercentage(admin.configuredManagerWeight)}`}
            />
            <WeightRow
              label="Evaluadores efectivos (auto / líder)"
              value={`${formatScorePercentage(admin.effectiveSelfWeight)} / ${formatScorePercentage(admin.effectiveManagerWeight)}`}
            />
            {integrated ? (
              <WeightRow
                label="Resultado general (comp. / obj.)"
                value={formatResultCompositionWeightLabel(
                  admin.configuredCompetencyResultWeight,
                  admin.configuredGoalsResultWeight,
                )}
              />
            ) : null}
          </dl>
          <dl className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <div>
              <dt className="font-medium text-foreground">Calculado</dt>
              <dd>{admin.calculatedAt}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Publicado</dt>
              <dd>{admin.releasedAt ?? "—"}</dd>
            </div>
            {admin.releasedBy ? (
              <div className="sm:col-span-2">
                <dt className="font-medium text-foreground">Publicado por</dt>
                <dd>{employeeName(admin.releasedBy)}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : (
        <section className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          <p>
            Overall: {formatScorePercentage(data.overallScore)}
            {"selfScore" in data
              ? ` · Autoevaluación: ${formatScorePercentage(data.selfScore)}`
              : ""}
          </p>
          {"effectiveSelfWeight" in data ? (
            <p className="mt-2">
              Pesos efectivos:{" "}
              {formatScorePercentage(data.effectiveSelfWeight)} /{" "}
              {formatScorePercentage(data.effectiveManagerWeight)}
            </p>
          ) : null}
        </section>
      )}

      {admin && integrated ? (
        <section className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h2 className="text-base font-semibold">Desglose de objetivos</h2>
          <ResultGoalsBreakdown goals={admin.goals} showConfiguredWeight />
        </section>
      ) : null}
    </div>
  );
}

function ScoreCard({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={
          emphasize ? "mt-1 text-2xl font-semibold" : "mt-1 text-xl font-medium"
        }
      >
        {value}
      </p>
    </div>
  );
}

function WeightRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
