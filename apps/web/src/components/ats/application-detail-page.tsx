"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  emptyInterviewForm,
  InterviewForm,
  toCreateInterviewPayload,
  type InterviewFormValues,
} from "@/components/ats/interview-form";
import { ApplicationOfferSection } from "@/components/ats/offer-detail-page";
import { EntityEditorShell } from "@/components/organization/entity-editor-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyId } from "@/hooks/use-company-id";
import { atsApi, atsKeys } from "@/lib/api/ats";
import { getErrorMessage } from "@/lib/api/errors";
import { interviewKeys, interviewsApi } from "@/lib/api/interviews";
import { organizationApi, orgKeys } from "@/lib/api/organization";
import {
  APPLICATION_STAGE_LABELS,
  APPLICATION_STATUS_LABELS,
  applicationStageVariant,
  canScheduleInterviewForStage,
  formatDate,
  formatEmployeeName,
  INTERVIEW_STATUS_LABELS,
  INTERVIEW_TYPE_LABELS,
  interviewStatusVariant,
} from "@/lib/ats/labels";

export function ApplicationDetailPageClient() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyInterviewForm());
  const [formError, setFormError] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: atsKeys.application(companyId, id),
    queryFn: () => atsApi.getApplication(id),
  });

  const historyQuery = useQuery({
    queryKey: atsKeys.applicationHistory(companyId, id),
    queryFn: () => atsApi.getApplicationHistory(id),
  });

  const interviewsQuery = useQuery({
    queryKey: interviewKeys.byApplication(companyId, id),
    queryFn: () => interviewsApi.listByApplication(id),
  });

  const employeesQuery = useQuery({
    queryKey: orgKeys.employees(companyId, {
      status: "ACTIVE",
      page: 1,
      limit: 100,
    }),
    queryFn: () =>
      organizationApi.listEmployees({
        status: "ACTIVE",
        page: 1,
        limit: 100,
      }),
    enabled: open,
  });

  const templatesQuery = useQuery({
    queryKey: interviewKeys.templates(companyId),
    queryFn: () => interviewsApi.listTemplates(),
    enabled: open,
  });

  const employeeOptions = useMemo(
    () =>
      (employeesQuery.data?.items ?? []).map((e) => ({
        value: e.id,
        label: `${e.firstName} ${e.lastName}`,
      })),
    [employeesQuery.data],
  );

  const templateOptions = useMemo(
    () =>
      (templatesQuery.data ?? [])
        .filter((t) => t.status === "ACTIVE")
        .map((t) => ({ value: t.id, label: t.name })),
    [templatesQuery.data],
  );

  const createMutation = useMutation({
    mutationFn: (values: InterviewFormValues) =>
      interviewsApi.createForApplication(id, toCreateInterviewPayload(values)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: interviewKeys.all(companyId),
      });
      setOpen(false);
      setForm(emptyInterviewForm());
      setFormError(null);
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, "No se pudo crear la entrevista."));
    },
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
  const canCreate = canScheduleInterviewForStage(application.stage);
  const interviews = interviewsQuery.data ?? [];

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
              <Link href={`/ats/pipeline?vacancyId=${application.vacancyId}`}>
                Ver pipeline
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/ats/interviews?applicationId=${id}`}>
                Entrevistas
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

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Entrevistas</h2>
          {canCreate ? (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setForm(emptyInterviewForm());
                setFormError(null);
                setOpen(true);
              }}
            >
              Programar entrevista
            </Button>
          ) : null}
        </div>
        {interviewsQuery.isLoading ? <Skeleton className="h-24 w-full" /> : null}
        {interviewsQuery.isError ? (
          <ErrorState
            title="No se pudieron cargar las entrevistas"
            description={getErrorMessage(interviewsQuery.error, "Error.")}
            onRetry={() => void interviewsQuery.refetch()}
          />
        ) : null}
        {interviewsQuery.isSuccess && interviews.length === 0 ? (
          <EmptyState title="Aún no hay entrevistas en este proceso." />
        ) : null}
        <ul className="space-y-2">
          {interviews.map((interview) => (
            <li
              key={interview.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
            >
              <div>
                <p className="font-medium">
                  {INTERVIEW_TYPE_LABELS[interview.type]}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(interview.scheduledAt)} ·{" "}
                  {(interview.interviewers ?? [])
                    .map((i) => formatEmployeeName(i.employee))
                    .join(", ") || "Sin entrevistadores"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={interviewStatusVariant(interview.status)}>
                  {INTERVIEW_STATUS_LABELS[interview.status]}
                </Badge>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/ats/interviews/${interview.id}`}>Abrir</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <ApplicationOfferSection
        applicationId={id}
        applicationStage={application.stage}
      />

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

      <EntityEditorShell
        open={open}
        onOpenChange={setOpen}
        title="Programar entrevista"
      >
        <InterviewForm
          values={form}
          onChange={setForm}
          onCancel={() => setOpen(false)}
          onSubmit={() => createMutation.mutate(form)}
          submitting={createMutation.isPending}
          error={formError}
          employees={employeeOptions}
          templates={templateOptions}
        />
      </EntityEditorShell>
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
