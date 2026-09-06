"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { InterviewTranscriptPanel } from "@/components/ats/interview-transcript-panel";
import { FormSelect } from "@/components/organization/form-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/components/auth/session-provider";
import { atsApi, atsKeys } from "@/lib/api/ats";
import { getErrorMessage } from "@/lib/api/errors";
import { interviewKeys, interviewsApi } from "@/lib/api/interviews";
import {
  buildAnswerPayload,
  draftFromAnswer,
  findMyAnswer,
  isAnswerEditableStatus,
  otherAnswers,
  type AnswerDraft,
} from "@/lib/ats/interview-answers";
import { INTERVIEW_QUESTION_TYPE_LABELS } from "@/lib/ats/labels";
import {
  INTERVIEW_PHASE_DECISION_LABELS,
  interviewPhaseDecisionOptions,
  nextStageForInterviewAdvance,
  type InterviewPhaseDecision,
} from "@/lib/ats/pipeline-kanban";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type { ApplicationStage } from "@/types/ats";
import type { Interview, InterviewQuestion } from "@/types/interviews";

type Props = {
  companyId: string;
  interview: Interview;
  userId: string | undefined;
  applicationStage?: ApplicationStage;
  /** When true, show transcript as the main capture surface instead of Q&A pairs. */
  transcriptionEnabled?: boolean;
  showTranscriptPanel?: boolean;
};

export function InterviewEvaluationPanel({
  companyId,
  interview,
  userId,
  applicationStage,
  transcriptionEnabled,
  showTranscriptPanel = true,
}: Props) {
  const { companyAccess } = useSession();
  const hasRecordingFeature = (
    companyAccess?.enabledFeatures ?? []
  ).includes("premium.interview-recording");
  const useTranscription =
    transcriptionEnabled ?? hasRecordingFeature;

  const questions = [...(interview.questions ?? [])].sort(
    (a, b) => a.order - b.order,
  );
  const editable = isAnswerEditableStatus(interview.status);
  const transcriptEditable =
    interview.status !== "CANCELLED" && interview.status !== "COMPLETED";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Formulario de evaluación</h2>
        <p className="text-sm text-muted-foreground">
          {useTranscription
            ? "Transcripción habilitada: registra la entrevista en un solo campo editable y completa el veredicto."
            : "Transcripción deshabilitada: agrega las preguntas y respuestas que necesites."}
        </p>
      </div>

      {useTranscription && showTranscriptPanel ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Entrevista / transcripción</h3>
          <InterviewTranscriptPanel
            companyId={companyId}
            interviewId={interview.id}
            interviewStatus={interview.status}
            canEdit={transcriptEditable}
          />
          <InterviewNotesField
            companyId={companyId}
            interview={interview}
            editable={editable}
          />
        </section>
      ) : (
        <AdHocQuestionsSection
          companyId={companyId}
          interview={interview}
          questions={questions}
          userId={userId}
          editable={editable}
        />
      )}

      <EvaluatorVerdictPanel
        companyId={companyId}
        interview={interview}
        stage={applicationStage}
        editable={editable}
      />
    </div>
  );
}

function InterviewNotesField({
  companyId,
  interview,
  editable,
}: {
  companyId: string;
  interview: Interview;
  editable: boolean;
}) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(interview.notes ?? "");
  const saveMutation = useMutation({
    mutationFn: () =>
      interviewsApi.updateInterview(interview.id, { notes }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: interviewKeys.detail(companyId, interview.id),
      });
      notifySuccess("Notas guardadas");
    },
    onError: (error) => notifyError(error, "No se pudieron guardar las notas."),
  });

  return (
    <div className="space-y-2">
      <Label htmlFor={`interview-notes-${interview.id}`}>
        Notas de la entrevista
      </Label>
      <Textarea
        id={`interview-notes-${interview.id}`}
        rows={4}
        value={notes}
        disabled={!editable || saveMutation.isPending}
        onChange={(event) => setNotes(event.target.value)}
        maxLength={2000}
        placeholder="Resumen libre de la conversación (editable junto a la transcripción)."
      />
      {editable ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          Guardar notas
        </Button>
      ) : null}
    </div>
  );
}

function AdHocQuestionsSection({
  companyId,
  interview,
  questions,
  userId,
  editable,
}: {
  companyId: string;
  interview: Interview;
  questions: InterviewQuestion[];
  userId: string | undefined;
  editable: boolean;
}) {
  const queryClient = useQueryClient();
  const [draftText, setDraftText] = useState("");

  const addMutation = useMutation({
    mutationFn: () =>
      interviewsApi.addAdHocQuestion(interview.id, {
        text: draftText.trim(),
        type: "TEXTAREA",
        required: false,
      }),
    onSuccess: async () => {
      setDraftText("");
      await queryClient.invalidateQueries({
        queryKey: interviewKeys.detail(companyId, interview.id),
      });
      notifySuccess("Pregunta agregada");
    },
    onError: (error) =>
      notifyError(error, "No se pudo agregar la pregunta."),
  });

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Preguntas y respuestas</h3>
      </div>
      {questions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aún no hay preguntas. Agrega pares pregunta/respuesta según la
          entrevista.
        </p>
      ) : (
        questions.map((question) => (
          <QuestionAnswerCard
            key={`${question.id}:${findMyAnswer(question, userId)?.updatedAt ?? "new"}`}
            companyId={companyId}
            interviewId={interview.id}
            question={question}
            userId={userId}
            editable={editable}
          />
        ))
      )}
      {editable ? (
        <div className="space-y-2 rounded-lg border border-dashed p-3">
          <Label htmlFor={`adhoc-q-${interview.id}`}>
            Nueva pregunta
          </Label>
          <Textarea
            id={`adhoc-q-${interview.id}`}
            rows={2}
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
            placeholder="Escribe la pregunta…"
            maxLength={2000}
          />
          <Button
            type="button"
            size="sm"
            disabled={addMutation.isPending || !draftText.trim()}
            onClick={() => addMutation.mutate()}
          >
            <Plus className="size-4" />
            Agregar pregunta y respuesta
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function EvaluatorVerdictPanel({
  companyId,
  interview,
  stage,
  editable,
}: {
  companyId: string;
  interview: Interview;
  stage?: ApplicationStage;
  editable: boolean;
}) {
  const queryClient = useQueryClient();
  const [strengths, setStrengths] = useState(interview.strengths ?? "");
  const [improvements, setImprovements] = useState(
    interview.improvements ?? "",
  );
  const [error, setError] = useState<string | null>(null);

  const decisionMutation = useMutation({
    mutationFn: async (decision: "APPROVE" | "REJECT") => {
      return interviewsApi.evaluatorDecision(interview.id, {
        decision,
        strengths,
        improvements,
      });
    },
    onSuccess: async (_data, decision) => {
      await queryClient.invalidateQueries({ queryKey: atsKeys.all(companyId) });
      await queryClient.invalidateQueries({
        queryKey: interviewKeys.all(companyId),
      });
      notifySuccess(
        decision === "APPROVE"
          ? stage === "INTERVIEW"
            ? "Evaluación aprobada"
            : "Decisión registrada"
          : "Candidato rechazado",
      );
      setError(null);
    },
    onError: (err) => {
      setError(getErrorMessage(err, "No se pudo registrar la decisión."));
      notifyError(err, "No se pudo registrar la decisión.");
    },
  });

  const showEvaluatorActions = stage === "INTERVIEW" && editable;

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="space-y-2">
        <Label htmlFor="eval-strengths">Fortalezas</Label>
        <Textarea
          id="eval-strengths"
          rows={3}
          value={strengths}
          disabled={!editable || decisionMutation.isPending}
          onChange={(event) => setStrengths(event.target.value)}
          maxLength={4000}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="eval-improvements">Oportunidades de mejora</Label>
        <Textarea
          id="eval-improvements"
          rows={3}
          value={improvements}
          disabled={!editable || decisionMutation.isPending}
          onChange={(event) => setImprovements(event.target.value)}
          maxLength={4000}
        />
      </div>
      {showEvaluatorActions ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={decisionMutation.isPending}
            onClick={() => decisionMutation.mutate("APPROVE")}
          >
            Aprobar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={decisionMutation.isPending}
            onClick={() => decisionMutation.mutate("REJECT")}
          >
            Rechazar
          </Button>
        </div>
      ) : (
        <InterviewPhaseDecisionField
          companyId={companyId}
          applicationId={interview.applicationId}
          stage={stage}
          editable={editable}
        />
      )}
      <p className="text-xs text-muted-foreground">
        Aprobar envía al siguiente evaluador configurado. Si era el último,
        el candidato pasa a Finalistas para validación del reclutador.
        Rechazar cierra la postulación.
      </p>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function InterviewPhaseDecisionField({
  companyId,
  applicationId,
  stage,
  editable,
}: {
  companyId: string;
  applicationId: string;
  stage?: ApplicationStage;
  editable: boolean;
}) {
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<InterviewPhaseDecision>("STANDBY");
  const [error, setError] = useState<string | null>(null);

  const decisionMutation = useMutation({
    mutationFn: async (next: InterviewPhaseDecision) => {
      if (next === "DISCARDED") {
        await atsApi.moveApplication(applicationId, {
          stage: "REJECTED",
          comment: "Descartado en evaluación de entrevista",
        });
        return "moved" as const;
      }
      const target = stage ? nextStageForInterviewAdvance(stage) : null;
      if (!target) return "hire-hint" as const;
      await atsApi.moveApplication(applicationId, { stage: target });
      return "moved" as const;
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: atsKeys.all(companyId) });
      await queryClient.invalidateQueries({
        queryKey: interviewKeys.all(companyId),
      });
      notifySuccess(
        result === "hire-hint"
          ? 'Para contratar, muévelo a la columna "a Contratar" en el Pipeline.'
          : "Estado de fase actualizado",
      );
      setError(null);
    },
    onError: (err) => {
      setError(getErrorMessage(err, "No se pudo actualizar el estado."));
      notifyError(err, "No se pudo actualizar el estado.");
    },
  });

  const options = interviewPhaseDecisionOptions();

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <FormSelect
        id="interview-phase-decision"
        label="Estado del candidato en esta fase"
        value={decision}
        onChange={(value) => {
          const next = value as InterviewPhaseDecision;
          setDecision(next);
          if (!editable || next === "STANDBY") return;
          decisionMutation.mutate(next);
        }}
        options={options.map((value) => ({
          value,
          label: INTERVIEW_PHASE_DECISION_LABELS[value],
        }))}
        disabled={!editable || decisionMutation.isPending}
      />
      <p className="text-xs text-muted-foreground">
        Descartado cierra el proceso. Standby lo deja en esta fase. Pasar a la
        siguiente lo mueve en el pipeline.
      </p>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function QuestionAnswerCard({
  companyId,
  interviewId,
  question,
  userId,
  editable,
}: {
  companyId: string;
  interviewId: string;
  question: InterviewQuestion;
  userId: string | undefined;
  editable: boolean;
}) {
  const queryClient = useQueryClient();
  const mine = findMyAnswer(question, userId);
  const others = otherAnswers(question, userId);
  const [draft, setDraft] = useState<AnswerDraft>(() => draftFromAnswer(mine));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const isAdHoc = !question.sourceTemplateQuestionId;

  const saveMutation = useMutation({
    mutationFn: () =>
      interviewsApi.upsertAnswer(
        interviewId,
        question.id,
        buildAnswerPayload(question.type, draft),
      ),
    onMutate: () => {
      setStatus("saving");
      setError(null);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: interviewKeys.detail(companyId, interviewId),
      });
      setStatus("saved");
    },
    onError: (err) => {
      setStatus("error");
      setError(getErrorMessage(err, "No se pudo guardar la respuesta."));
    },
  });

  const removeMutation = useMutation({
    mutationFn: () =>
      interviewsApi.removeAdHocQuestion(interviewId, question.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: interviewKeys.detail(companyId, interviewId),
      });
      notifySuccess("Pregunta eliminada");
    },
    onError: (err) => notifyError(err, "No se pudo eliminar la pregunta."),
  });

  return (
    <article className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="font-medium">
            {question.text}
            {question.required ? (
              <span className="text-destructive"> *</span>
            ) : null}
          </p>
          <p className="text-xs text-muted-foreground">
            {INTERVIEW_QUESTION_TYPE_LABELS[question.type]}
            {isAdHoc ? " · Ad-hoc" : ""}
            {question.weight != null ? ` · Peso ${question.weight}` : ""}
          </p>
        </div>
        {editable && isAdHoc ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label="Eliminar pregunta"
            disabled={removeMutation.isPending}
            onClick={() => removeMutation.mutate()}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>

      {editable ? (
        <AnswerControls
          question={question}
          draft={draft}
          onChange={setDraft}
        />
      ) : (
        <ReadOnlyAnswer question={question} answer={mine} />
      )}

      {others.length > 0 ? (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Otras respuestas
          </p>
          {others.map((answer) => (
            <div key={answer.id} className="text-sm text-muted-foreground">
              <span className="font-mono text-xs">
                userId {answer.answeredByUserId}
              </span>
              : <ReadOnlyAnswer inline question={question} answer={answer} />
            </div>
          ))}
        </div>
      ) : null}

      {editable ? (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            size="sm"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            Guardar respuesta
          </Button>
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {status === "saving"
              ? "Guardando…"
              : status === "saved"
                ? "Guardado"
                : status === "error"
                  ? "Error"
                  : null}
          </span>
        </div>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </article>
  );
}

function AnswerControls({
  question,
  draft,
  onChange,
}: {
  question: InterviewQuestion;
  draft: AnswerDraft;
  onChange: (draft: AnswerDraft) => void;
}) {
  switch (question.type) {
    case "TEXT":
      return (
        <div className="space-y-2">
          <Label htmlFor={`q-${question.id}`}>Respuesta</Label>
          <Input
            id={`q-${question.id}`}
            value={draft.answerText}
            onChange={(e) =>
              onChange({ ...draft, answerText: e.target.value })
            }
          />
        </div>
      );
    case "TEXTAREA":
      return (
        <div className="space-y-2">
          <Label htmlFor={`q-${question.id}`}>Respuesta</Label>
          <Textarea
            id={`q-${question.id}`}
            value={draft.answerText}
            onChange={(e) =>
              onChange({ ...draft, answerText: e.target.value })
            }
            rows={4}
          />
        </div>
      );
    case "RATING":
      return (
        <FormSelect
          id={`q-${question.id}`}
          label="Calificación"
          value={draft.rating}
          onChange={(rating) => onChange({ ...draft, rating })}
          options={[1, 2, 3, 4, 5].map((n) => ({
            value: String(n),
            label: String(n),
          }))}
          allowEmpty
          emptyLabel="Sin calificar"
        />
      );
    case "YES_NO":
      return (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Respuesta</legend>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={draft.yesNo === "true" ? "default" : "outline"}
              onClick={() => onChange({ ...draft, yesNo: "true" })}
            >
              Sí
            </Button>
            <Button
              type="button"
              size="sm"
              variant={draft.yesNo === "false" ? "default" : "outline"}
              onClick={() => onChange({ ...draft, yesNo: "false" })}
            >
              No
            </Button>
          </div>
        </fieldset>
      );
    default:
      return null;
  }
}

function ReadOnlyAnswer({
  question,
  answer,
  inline,
}: {
  question: InterviewQuestion;
  answer: ReturnType<typeof findMyAnswer>;
  inline?: boolean;
}) {
  if (!answer) {
    return inline ? (
      <span>Sin respuesta</span>
    ) : (
      <p className="text-sm text-muted-foreground">Sin respuesta</p>
    );
  }
  let text = "—";
  if (question.type === "RATING") text = String(answer.rating ?? "—");
  else if (question.type === "YES_NO")
    text = answer.yesNo === true ? "Sí" : answer.yesNo === false ? "No" : "—";
  else text = answer.answerText?.trim() || "—";

  if (inline) return <span>{text}</span>;
  return <p className="text-sm whitespace-pre-wrap">{text}</p>;
}
