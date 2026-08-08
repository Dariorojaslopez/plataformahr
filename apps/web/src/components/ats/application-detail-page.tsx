"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyId } from "@/hooks/use-company-id";
import { atsApi, atsKeys } from "@/lib/api/ats";
import { getErrorMessage } from "@/lib/api/errors";
import {
  APPLICATION_STAGE_LABELS,
  APPLICATION_STATUS_LABELS,
  applicationStageVariant,
  formatDate,
} from "@/lib/ats/labels";

export function ApplicationDetailPageClient() {
  const companyId = useCompanyId();
  const { id } = useParams<{ id: string }>();

  const detailQuery = useQuery({
    queryKey: atsKeys.application(companyId, id),
    queryFn: () => atsApi.getApplication(id),
  });

  const historyQuery = useQuery({
    queryKey: atsKeys.applicationHistory(companyId, id),
    queryFn: () => atsApi.getApplicationHistory(id),
  });

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <ErrorState
        title="Aplicación no disponible"
        description={getErrorMessage(
          detailQuery.error,
          "No se encontró la aplicación.",
        )}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  const application = detailQuery.data;
  const candidateName = application.candidate
    ? `${application.candidate.firstName} ${application.candidate.lastName}`
    : application.candidateId;

  return (
    <div className="space-y-6">
      <PageHeader
        title={candidateName}
        description={application.vacancy?.title ?? "Aplicación"}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href={`/ats/candidates/${application.candidateId}`}>
                Ver candidato
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link
                href={`/ats/pipeline?vacancyId=${application.vacancyId}`}
              >
                Ver pipeline
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Etapa">
          <Badge variant={applicationStageVariant(application.stage)}>
            {APPLICATION_STAGE_LABELS[application.stage]}
          </Badge>
        </Field>
        <Field label="Estado">
          {APPLICATION_STATUS_LABELS[application.status]}
        </Field>
        <Field label="Aplicó">{formatDate(application.appliedAt)}</Field>
        <Field label="Último cambio">
          {formatDate(application.lastStageChangedAt)}
        </Field>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Historial</h2>
        {historyQuery.isLoading ? <Skeleton className="h-32 w-full" /> : null}
        {historyQuery.isError ? (
          <ErrorState
            title="No se pudo cargar el historial"
            description={getErrorMessage(historyQuery.error, "Error.")}
            onRetry={() => void historyQuery.refetch()}
          />
        ) : null}
        {historyQuery.isSuccess && (historyQuery.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Sin movimientos.</p>
        ) : null}
        <ol className="space-y-4">
          {(historyQuery.data ?? []).map((entry) => (
            <li
              key={entry.id}
              className="rounded-lg border border-border p-3 text-sm"
            >
              <p className="font-medium">
                {entry.fromStage
                  ? APPLICATION_STAGE_LABELS[entry.fromStage]
                  : "Inicio"}{" "}
                → {APPLICATION_STAGE_LABELS[entry.toStage]}
              </p>
              <p className="text-muted-foreground">
                {formatDate(entry.createdAt)}
                {entry.changedByUserId
                  ? ` · userId ${entry.changedByUserId}`
                  : ""}
              </p>
              {entry.comment ? <p className="mt-1">{entry.comment}</p> : null}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="text-sm">{children}</div>
    </div>
  );
}
