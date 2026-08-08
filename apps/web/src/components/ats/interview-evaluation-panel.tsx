"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FormSelect } from "@/components/organization/form-select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import type { Interview, InterviewQuestion } from "@/types/interviews";

type Props = {
  companyId: string;
  interview: Interview;
  userId: string | undefined;
};

export function InterviewEvaluationPanel({
  companyId,
  interview,
  userId,
}: Props) {
  const questions = [...(interview.questions ?? [])].sort(
    (a, b) => a.order - b.order,
  );
  const editable = isAnswerEditableStatus(interview.status);

  if (questions.length === 0) {
    return (
      <EmptyState title="Esta entrevista no tiene preguntas configuradas." />
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Evaluación</h2>
      {questions.map((question) => (
        <QuestionAnswerCard
          key={`${question.id}:${findMyAnswer(question, userId)?.updatedAt ?? "new"}`}
          companyId={companyId}
          interviewId={interview.id}
          question={question}
          userId={userId}
          editable={editable}
        />
      ))}
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

  const saveMutation = useMutation({    mutationFn: () =>
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

  return (
    <article className="space-y-3 rounded-lg border border-border p-4">
      <div className="space-y-1">
        <p className="font-medium">
          {question.text}
          {question.required ? (
            <span className="text-destructive"> *</span>
          ) : null}
        </p>
        <p className="text-xs text-muted-foreground">
          {INTERVIEW_QUESTION_TYPE_LABELS[question.type]}
          {question.weight != null ? ` · Peso ${question.weight}` : ""}
        </p>
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
