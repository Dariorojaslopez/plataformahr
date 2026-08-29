"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { InterviewEvaluationPanel } from "@/components/ats/interview-evaluation-panel";
import { InterviewTimer } from "@/components/ats/interview-timer";
import { InterviewTranscriptPanel } from "@/components/ats/interview-transcript-panel";
import { useSession } from "@/components/auth/session-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCompanyId } from "@/hooks/use-company-id";
import { atsApi, atsKeys } from "@/lib/api/ats";
import { getErrorMessage } from "@/lib/api/errors";
import { interviewKeys, interviewsApi } from "@/lib/api/interviews";
import { missingRequiredQuestions } from "@/lib/ats/interview-answers";
import {
  formatDate,
  formatEmployeeName,
  INTERVIEW_STATUS_LABELS,
  INTERVIEW_TYPE_LABELS,
  interviewStatusVariant,
} from "@/lib/ats/labels";
import { safeHttpUrl } from "@/lib/ui/safe-url";
import { notifyError, notifySuccess } from "@/lib/ui/notify";

export function InterviewDetailPageClient() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { id } = useParams<{ id: string }>();

  const [confirm, setConfirm] = useState<
    null | "start" | "complete" | "cancel"
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: interviewKeys.detail(companyId, id),
    queryFn: () => interviewsApi.getInterview(id),
  });

  const applicationId = detailQuery.data?.applicationId;
  const applicationQuery = useQuery({
    queryKey: atsKeys.application(companyId, applicationId ?? ""),
    queryFn: () => atsApi.getApplication(applicationId!),
    enabled: Boolean(applicationId),
  });

  async function invalidateAll() {
    await queryClient.invalidateQueries({
      queryKey: interviewKeys.all(companyId),
    });
    if (applicationId) {
      await queryClient.invalidateQueries({
        queryKey: atsKeys.application(companyId, applicationId),
      });
      await queryClient.invalidateQueries({
        queryKey: atsKeys.applicationHistory(companyId, applicationId),
      });
      const vacancyId = applicationQuery.data?.vacancyId;
      if (vacancyId) {
        await queryClient.invalidateQueries({
          queryKey: atsKeys.pipeline(companyId, vacancyId),
        });
      }
    }
    await queryClient.invalidateQueries({
      queryKey: atsKeys.all(companyId),
    });
  }

  const startMutation = useMutation({
    mutationFn: () => interviewsApi.startInterview(id),
    onSuccess: async () => {
      await invalidateAll();
      setConfirm(null);
      setActionError(null);
      notifySuccess("Entrevista iniciada");
    },
    onError: (error) => {
      setActionError(getErrorMessage(error, "No se pudo iniciar."));
      setConfirm(null);
      notifyError(error, "No se pudo iniciar.");
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => interviewsApi.completeInterview(id),
    onSuccess: async () => {
      await invalidateAll();
      setConfirm(null);
      setActionError(null);
      notifySuccess("Entrevista completada");
    },
    onError: (error) => {
      setActionError(
        getErrorMessage(
          error,
          "No se pudo finalizar. Revisa preguntas requeridas.",
        ),
      );
      setConfirm(null);
      notifyError(error, "No se pudo finalizar. Revisa preguntas requeridas.");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => interviewsApi.cancelInterview(id),
    onSuccess: async () => {
      await invalidateAll();
      setConfirm(null);
      setActionError(null);
      notifySuccess("Entrevista cancelada");
    },
    onError: (error) => {
      setActionError(getErrorMessage(error, "No se pudo cancelar."));
      setConfirm(null);
      notifyError(error, "No se pudo cancelar.");
    },
  });

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <ErrorState
        title="Entrevista no disponible"
        description={getErrorMessage(
          detailQuery.error,
          "No se encontró la entrevista.",
        )}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  const interview = detailQuery.data;
  const application = applicationQuery.data;
  const candidateName = application?.candidate
    ? `${application.candidate.firstName} ${application.candidate.lastName}`
    : "Candidato";
  const vacancyTitle = application?.vacancy?.title ?? "Vacante";
  const missing = missingRequiredQuestions(
    interview.questions ?? [],
    user?.id,
  );
  const canTranscribe =
    interview.status !== "CANCELLED" && interview.status !== "COMPLETED"
      ? true
      : interview.status === "COMPLETED";

  const meetingHref = safeHttpUrl(interview.meetingUrl);

  // Transcript can be viewed when completed; edits blocked in panel via canEdit
  const transcriptEditable =
    interview.status !== "CANCELLED" && interview.status !== "COMPLETED";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${INTERVIEW_TYPE_LABELS[interview.type]} · ${candidateName}`}
        description={vacancyTitle}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href={`/ats/applications/${interview.applicationId}`}>
                Ver aplicación
              </Link>
            </Button>
            {interview.status === "SCHEDULED" ? (
              <Button type="button" onClick={() => setConfirm("start")}>
                Iniciar entrevista
              </Button>
            ) : null}
            {interview.status === "IN_PROGRESS" ? (
              <Button type="button" onClick={() => setConfirm("complete")}>
                Finalizar entrevista
              </Button>
            ) : null}
            {interview.status === "DRAFT" ||
            interview.status === "SCHEDULED" ||
            interview.status === "IN_PROGRESS" ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setConfirm("cancel")}
              >
                Cancelar entrevista
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={interviewStatusVariant(interview.status)}>
          {INTERVIEW_STATUS_LABELS[interview.status]}
        </Badge>
        <span className="text-sm text-muted-foreground">
          Programada: {formatDate(interview.scheduledAt)}
        </span>
        {interview.status === "IN_PROGRESS" && interview.startedAt ? (
          <InterviewTimer startedAt={interview.startedAt} />
        ) : null}
      </div>

      {actionError ? (
        <p className="text-sm text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Ubicación">{interview.location ?? "—"}</Field>
        <Field label="Reunión">
          {meetingHref ? (
            <a
              href={meetingHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-2 hover:underline"
            >
              Abrir reunión
            </a>
          ) : (
            (interview.meetingUrl ?? "—")
          )}
        </Field>
        <Field label="Grabación local">
          {interview.localRecordingName ?? "—"}
        </Field>
        <Field label="Iniciada">{formatDate(interview.startedAt)}</Field>
        <Field label="Finalizada">{formatDate(interview.completedAt)}</Field>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Entrevistadores</h2>
        <ul className="space-y-1 text-sm">
          {(interview.interviewers ?? []).map((row) => (
            <li key={row.employeeId}>
              {formatEmployeeName(row.employee)}
              {row.employee?.email ? (
                <span className="text-muted-foreground">
                  {" "}
                  · {row.employee.email}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {interview.status === "IN_PROGRESS" ||
      interview.status === "COMPLETED" ? (
        <>
          <div className="hidden gap-6 lg:grid lg:grid-cols-2">
            <InterviewEvaluationPanel
              companyId={companyId}
              interview={interview}
              userId={user?.id}
              applicationStage={application?.stage}
            />
            {canTranscribe || interview.status === "COMPLETED" ? (
              <InterviewTranscriptPanel
                companyId={companyId}
                interviewId={interview.id}
                interviewStatus={interview.status}
                canEdit={transcriptEditable}
              />
            ) : null}
          </div>

          <div className="lg:hidden">
            <Tabs defaultValue="evaluation">
              <TabsList>
                <TabsTrigger value="evaluation">Evaluación</TabsTrigger>
                <TabsTrigger value="transcript">Transcripción</TabsTrigger>
              </TabsList>
              <TabsContent value="evaluation" className="mt-4">
                <InterviewEvaluationPanel
                  companyId={companyId}
                  interview={interview}
                  userId={user?.id}
                  applicationStage={application?.stage}
                />
              </TabsContent>
              <TabsContent value="transcript" className="mt-4">
                <InterviewTranscriptPanel
                  companyId={companyId}
                  interviewId={interview.id}
                  interviewStatus={interview.status}
                  canEdit={transcriptEditable}
                />
              </TabsContent>
            </Tabs>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Inicia la entrevista para abrir el workspace de evaluación y
          transcripción.
          {(interview._count?.questions ?? interview.questions?.length ?? 0) >
          0
            ? ` Hay ${interview.questions?.length ?? interview._count?.questions} pregunta(s) en snapshot.`
            : null}
        </p>
      )}

      {/* Also allow draft/scheduled to see questions read-only if loaded */}
      {interview.status !== "IN_PROGRESS" &&
      interview.status !== "COMPLETED" &&
      (interview.questions?.length ?? 0) > 0 ? (
        <InterviewEvaluationPanel
          companyId={companyId}
          interview={interview}
          userId={user?.id}
          applicationStage={application?.stage}
        />
      ) : null}

      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm === "start"
                ? "Iniciar entrevista"
                : confirm === "complete"
                  ? "Finalizar entrevista"
                  : "Cancelar entrevista"}
            </DialogTitle>
          </DialogHeader>
          {confirm === "complete" && missing.length > 0 ? (
            <div className="space-y-2 text-sm">
              <p className="text-destructive">
                Faltan respuestas a preguntas requeridas:
              </p>
              <ul className="list-disc pl-5">
                {missing.map((q) => (
                  <li key={q.id}>{q.text}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {confirm === "start"
                ? "La entrevista pasará a En curso. Si la aplicación está en Contactado, el backend la moverá a Entrevista."
                : confirm === "complete"
                  ? "Se marcará como Completada. La aplicación no avanzará automáticamente a Oferta."
                  : "Se cancelará la entrevista. Esta acción es irreversible desde la UI."}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirm(null)}
            >
              Volver
            </Button>
            <Button
              type="button"
              variant={confirm === "cancel" ? "destructive" : "default"}
              disabled={
                startMutation.isPending ||
                completeMutation.isPending ||
                cancelMutation.isPending ||
                (confirm === "complete" && missing.length > 0)
              }
              onClick={() => {
                if (confirm === "start") startMutation.mutate();
                if (confirm === "complete") completeMutation.mutate();
                if (confirm === "cancel") cancelMutation.mutate();
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
      <div className="text-sm break-all">{children}</div>
    </div>
  );
}
