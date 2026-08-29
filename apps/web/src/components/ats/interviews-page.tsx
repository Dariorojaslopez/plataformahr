"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { InterviewEvaluationPanel } from "@/components/ats/interview-evaluation-panel";
import { useSession } from "@/components/auth/session-provider";
import { EntityEditorShell } from "@/components/organization/entity-editor-shell";
import { FormSelect } from "@/components/organization/form-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyId } from "@/hooks/use-company-id";
import { getErrorMessage } from "@/lib/api/errors";
import { interviewKeys, interviewsApi } from "@/lib/api/interviews";
import {
  INTERVIEW_STATUS_LABELS,
  interviewStatusVariant,
} from "@/lib/ats/labels";
import {
  groupPendingInterviewsByVacancy,
  pendingCandidateName,
  pendingInterviewPhaseLabel,
} from "@/lib/ats/interviews-view";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type { ApplicationStage } from "@/types/ats";
import type { PendingInterview } from "@/types/interviews";

export function InterviewsPageClient() {
  const companyId = useCompanyId();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const applicationId = searchParams.get("applicationId") ?? "";

  const [selectedId, setSelectedId] = useState<string | null | "auto">("auto");

  const pendingQuery = useQuery({
    queryKey: interviewKeys.pending(companyId),
    queryFn: () => interviewsApi.listPending(),
  });

  const templatesQuery = useQuery({
    queryKey: interviewKeys.templates(companyId),
    queryFn: () => interviewsApi.listTemplates(),
  });

  const matchedFromQuery = applicationId
    ? (pendingQuery.data?.find(
        (item) => item.applicationId === applicationId,
      )?.id ?? null)
    : null;
  const activeId = selectedId === "auto" ? matchedFromQuery : selectedId;

  const detailQuery = useQuery({
    queryKey: interviewKeys.detail(companyId, activeId ?? ""),
    queryFn: () => interviewsApi.getInterview(activeId!),
    enabled: Boolean(activeId),
  });

  const groups = useMemo(
    () => groupPendingInterviewsByVacancy(pendingQuery.data ?? []),
    [pendingQuery.data],
  );

  const templateOptions = useMemo(
    () =>
      (templatesQuery.data ?? [])
        .filter((template) => template.status === "ACTIVE")
        .map((template) => ({ value: template.id, label: template.name })),
    [templatesQuery.data],
  );

  const applyMutation = useMutation({
    mutationFn: ({
      vacancyId,
      templateId,
    }: {
      vacancyId: string;
      templateId: string;
    }) => interviewsApi.applyProcessTemplate(vacancyId, templateId),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: interviewKeys.all(companyId),
      });
      notifySuccess(
        result.interviewsUpdated > 0
          ? `Plantilla aplicada a ${result.interviewsUpdated} entrevista(s).`
          : "Plantilla asignada al proceso.",
      );
    },
    onError: (error) => {
      notifyError(error, "No se pudo asignar la plantilla.");
    },
  });

  const selectedPending = (pendingQuery.data ?? []).find(
    (item) => item.id === activeId,
  );
  const selectedTitle = selectedPending
    ? pendingCandidateName(selectedPending)
    : "Formulario de entrevista";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entrevistas"
        description="Pendientes por realizar, agrupadas por proceso de selección."
        actions={
          <Button variant="outline" asChild>
            <Link href="/ats/interview-templates">Plantillas</Link>
          </Button>
        }
      />

      {pendingQuery.isError ? (
        <ErrorState
          title="No se pudieron cargar las entrevistas pendientes"
          description={getErrorMessage(pendingQuery.error, "Error al cargar.")}
          onRetry={() => void pendingQuery.refetch()}
        />
      ) : null}

      {pendingQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : null}

      {pendingQuery.isSuccess && groups.length === 0 ? (
        <EmptyState title="No hay entrevistas pendientes por realizar." />
      ) : null}

      {groups.map((group) => (
        <section
          key={group.vacancyId}
          className="space-y-3 rounded-lg border border-border p-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">{group.vacancyTitle}</h2>
              <p className="text-sm text-muted-foreground">
                {group.interviews.length} pendiente
                {group.interviews.length === 1 ? "" : "s"}
              </p>
            </div>
            {group.vacancyId !== "sin-proceso" ? (
              <FormSelect
                id={`process-template-${group.vacancyId}`}
                label="Plantilla de entrevista"
                value={group.templateId ?? ""}
                onChange={(templateId) => {
                  if (!templateId) return;
                  applyMutation.mutate({
                    vacancyId: group.vacancyId,
                    templateId,
                  });
                }}
                options={templateOptions}
                allowEmpty
                emptyLabel="Seleccionar plantilla…"
                placeholder={
                  templatesQuery.isLoading ? "Cargando…" : "Seleccionar"
                }
                disabled={applyMutation.isPending}
              />
            ) : null}
          </div>

          <ul className="space-y-2">
            {group.interviews.map((interview) => (
              <PendingInterviewRow
                key={interview.id}
                interview={interview}
                onEvaluate={() => setSelectedId(interview.id)}
              />
            ))}
          </ul>
        </section>
      ))}

      <EntityEditorShell
        open={Boolean(activeId)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        title={selectedTitle}
      >
        {detailQuery.isLoading ? <Skeleton className="h-40 w-full" /> : null}
        {detailQuery.isError ? (
          <ErrorState
            title="No se pudo cargar el formulario"
            description={getErrorMessage(
              detailQuery.error,
              "Error al cargar la entrevista.",
            )}
            onRetry={() => void detailQuery.refetch()}
          />
        ) : null}
        {detailQuery.isSuccess ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {pendingInterviewPhaseLabel(selectedPending?.application?.stage)}
            </p>
            <InterviewEvaluationPanel
              companyId={companyId}
              interview={detailQuery.data}
              userId={user?.id}
              applicationStage={
                selectedPending?.application?.stage as
                  | ApplicationStage
                  | undefined
              }
            />
            <Button variant="outline" size="sm" asChild>
              <Link href={`/ats/interviews/${detailQuery.data.id}`}>
                Abrir entrevista completa
              </Link>
            </Button>
          </div>
        ) : null}
      </EntityEditorShell>
    </div>
  );
}

function PendingInterviewRow({
  interview,
  onEvaluate,
}: {
  interview: PendingInterview;
  onEvaluate: () => void;
}) {
  return (
    <li className="flex flex-col gap-2 rounded-md border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-medium">
          {pendingCandidateName(interview)}
        </p>
        <p className="text-sm text-muted-foreground">
          {pendingInterviewPhaseLabel(interview.application?.stage)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={interviewStatusVariant(interview.status)}>
          {INTERVIEW_STATUS_LABELS[interview.status]}
        </Badge>
        <Button type="button" size="sm" onClick={onEvaluate}>
          Evaluar
        </Button>
        <Button variant="ghost" size="icon" asChild>
          <Link
            href={`/ats/interviews/${interview.id}`}
            aria-label="Abrir entrevista"
          >
            <Eye className="size-4" />
          </Link>
        </Button>
      </div>
    </li>
  );
}
