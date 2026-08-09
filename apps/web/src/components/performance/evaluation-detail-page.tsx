"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCompanyId } from "@/hooks/use-company-id";
import { getErrorMessage } from "@/lib/api/errors";
import { performanceApi, performanceKeys } from "@/lib/api/performance";
import { CYCLE_STATUS_LABELS } from "@/lib/performance/cycle-labels";
import {
  EVALUATION_STATUS_LABELS,
  EVALUATION_TYPE_LABELS,
  evaluationStatusVariant,
} from "@/lib/performance/evaluation-labels";
import { PARTICIPANT_STATUS_LABELS } from "@/lib/performance/participant-labels";
import {
  EVALUATION_COMMENT_MAX_LENGTH,
  buildSaveResponsePayload,
  evaluationProgress,
  formatScorePercentage,
  hasEvaluationResponseControls,
  isCompetencyDirty,
  requiredMissingCompetencies,
} from "@/lib/performance/response-workspace";
import { mapSnapshotCompetenciesForDisplay } from "@/lib/performance/snapshot-view";
import type { SnapshotCompetencyView } from "@/lib/performance/snapshot-view";
import { notifyError, notifySuccess } from "@/lib/ui/notify";

function personName(row: { firstName: string; lastName: string }): string {
  return `${row.firstName} ${row.lastName}`.trim();
}

type LocalDraft = {
  selectedScaleLevelId: string | null;
  comment: string;
};

export function EvaluationDetailPageClient() {
  const companyId = useCompanyId();
  const params = useParams<{ id: string }>();
  const evaluationId = params.id;
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, LocalDraft>>({});
  const [submitOpen, setSubmitOpen] = useState(false);
  const [highlightMissing, setHighlightMissing] = useState(false);

  const detailQuery = useQuery({
    queryKey: performanceKeys.evaluation(companyId, evaluationId),
    queryFn: () => performanceApi.getEvaluation(evaluationId),
  });

  function draftFor(comp: SnapshotCompetencyView): LocalDraft {
    return (
      drafts[comp.id] ?? {
        selectedScaleLevelId: comp.response?.selectedScaleLevelId ?? null,
        comment: comp.response?.comment ?? "",
      }
    );
  }

  async function invalidateRelated(cycleId: string) {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: performanceKeys.evaluation(companyId, evaluationId),
      }),
      queryClient.invalidateQueries({
        queryKey: performanceKeys.evaluationsMine(companyId),
      }),
      queryClient.invalidateQueries({
        queryKey: [...performanceKeys.all(companyId), "participants", cycleId],
      }),
    ]);
  }

  const saveMutation = useMutation({
    mutationFn: (args: {
      competencyId: string;
      scaleLevelId: string;
      comment: string;
    }) =>
      performanceApi.saveEvaluationResponse(evaluationId, args.competencyId, {
        ...buildSaveResponsePayload({
          scaleLevelId: args.scaleLevelId,
          comment: args.comment,
        }),
      }),
    onSuccess: async (_data, vars) => {
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[vars.competencyId];
        return next;
      });
      if (detailQuery.data) {
        await invalidateRelated(detailQuery.data.cycleId);
      }
      notifySuccess("Respuesta guardada");
    },
    onError: (error) => notifyError(error, "No se pudo guardar la respuesta."),
  });

  const submitMutation = useMutation({
    mutationFn: () => performanceApi.submitEvaluation(evaluationId),
    onSuccess: async (data) => {
      setSubmitOpen(false);
      await invalidateRelated(data.cycleId);
      notifySuccess("Evaluación enviada");
    },
    onError: (error) => {
      setHighlightMissing(true);
      notifyError(error, "No se pudo enviar la evaluación.");
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
        title="No se pudo cargar la evaluación"
        description={getErrorMessage(detailQuery.error, "Error al cargar.")}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  const evaluation = detailQuery.data;
  const competencies = mapSnapshotCompetenciesForDisplay(
    evaluation.competencies,
  );
  const editable = hasEvaluationResponseControls(evaluation);
  const progress = evaluationProgress({
    respondedCount: evaluation.respondedCount,
    competencyCount: evaluation.competencyCount,
  });
  const missingRequired = requiredMissingCompetencies(evaluation.competencies);

  function openSubmit() {
    setHighlightMissing(true);
    if (missingRequired.length > 0) {
      notifyError(
        new Error(
          `Faltan ${missingRequired.length} competencia(s) obligatoria(s).`,
        ),
        "Completa las competencias obligatorias antes de enviar.",
      );
      return;
    }
    setSubmitOpen(true);
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
          <Link href="/performance/my-evaluations">
            <ArrowLeft className="h-4 w-4" />
            Volver a mis evaluaciones
          </Link>
        </Button>
        <PageHeader
          title={EVALUATION_TYPE_LABELS[evaluation.type]}
          description={`${personName(evaluation.employee)} · ${evaluation.cycle.name}`}
        />
      </div>

      <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Estado</p>
          <Badge
            variant={evaluationStatusVariant(evaluation.status)}
            className="mt-1"
          >
            {EVALUATION_STATUS_LABELS[evaluation.status]}
          </Badge>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Ciclo</p>
          <p className="mt-1 text-sm font-medium">{evaluation.cycle.name}</p>
          <p className="text-xs text-muted-foreground">
            {CYCLE_STATUS_LABELS[evaluation.cycle.status]}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Colaborador</p>
          <p className="mt-1 text-sm font-medium">
            {personName(evaluation.employee)}
          </p>
          <p className="text-xs text-muted-foreground">
            {evaluation.employee.area.name} ·{" "}
            {evaluation.employee.position.name}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Evaluador</p>
          <p className="mt-1 text-sm font-medium">
            {evaluation.evaluatorEmployee
              ? personName(evaluation.evaluatorEmployee)
              : "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            Participante:{" "}
            {PARTICIPANT_STATUS_LABELS[evaluation.participant.status]}
          </p>
        </div>
      </div>

      {evaluation.status === "SUBMITTED" ? (
        <div
          className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm"
          role="status"
        >
          <p className="font-medium">Evaluación enviada</p>
          <p className="text-muted-foreground">
            Enviada:{" "}
            {evaluation.submittedAt
              ? new Date(evaluation.submittedAt).toLocaleString()
              : "—"}
          </p>
          <p className="mt-1">
            Resultado de esta evaluación:{" "}
            <span className="font-semibold">
              {formatScorePercentage(evaluation.scorePercentage)}
            </span>
          </p>
        </div>
      ) : editable ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">{progress.label}</p>
            <p className="text-xs text-muted-foreground">
              Progreso persistido: {progress.percent}%
            </p>
          </div>
          <Button
            type="button"
            onClick={openSubmit}
            disabled={submitMutation.isPending}
          >
            Enviar evaluación
          </Button>
        </div>
      ) : (
        <div
          className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm"
          role="status"
        >
          Esta evaluación está{" "}
          {EVALUATION_STATUS_LABELS[evaluation.status].toLowerCase()}. Solo el
          evaluador asignado puede modificar respuestas mientras el ciclo y el
          participante estén activos.
        </div>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Competencias</h2>
          <p className="text-sm text-muted-foreground">
            Niveles y textos provienen del snapshot histórico. No se consulta el
            catálogo actual.
          </p>
        </div>

        {competencies.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Esta evaluación no tiene competencias en el snapshot.
          </p>
        ) : (
          <div className="space-y-4">
            {competencies.map((comp) => {
              const draft = draftFor(comp);
              return (
              <CompetencyCard
                key={comp.id}
                competency={comp}
                editable={editable}
                highlightMissing={
                  highlightMissing &&
                  comp.required &&
                  !comp.response &&
                  !draft.selectedScaleLevelId
                }
                draft={draft}
                saving={
                  saveMutation.isPending &&
                  saveMutation.variables?.competencyId === comp.id
                }
                onChange={(next) =>
                  setDrafts((prev) => ({ ...prev, [comp.id]: next }))
                }
                onSave={() => {
                  if (!draft.selectedScaleLevelId) {
                    notifyError(
                      new Error("Selecciona un nivel"),
                      "Selecciona un nivel antes de guardar.",
                    );
                    return;
                  }
                  saveMutation.mutate({
                    competencyId: comp.id,
                    scaleLevelId: draft.selectedScaleLevelId,
                    comment: draft.comment,
                  });
                }}
              />
              );
            })}
          </div>
        )}
      </section>

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar evaluación</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Después de enviar la evaluación no podrás modificar tus respuestas.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSubmitOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
            >
              Confirmar envío
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CompetencyCard({
  competency,
  editable,
  highlightMissing,
  draft,
  saving,
  onChange,
  onSave,
}: {
  competency: SnapshotCompetencyView;
  editable: boolean;
  highlightMissing: boolean;
  draft: LocalDraft;
  saving: boolean;
  onChange: (next: LocalDraft) => void;
  onSave: () => void;
}) {
  const dirty = useMemo(
    () =>
      isCompetencyDirty({
        selectedScaleLevelId: draft.selectedScaleLevelId,
        comment: draft.comment,
        saved: competency.response ?? null,
      }),
    [draft, competency.response],
  );

  const selectedLevel = competency.levels.find(
    (l) =>
      l.id ===
      (draft.selectedScaleLevelId ?? competency.response?.selectedScaleLevelId),
  );

  return (
    <article
      className={`space-y-3 rounded-lg border bg-card p-4 ${
        highlightMissing ? "border-destructive" : "border-border"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-medium">
            {competency.name}
            {competency.code ? (
              <span className="ml-2 text-sm text-muted-foreground">
                ({competency.code})
              </span>
            ) : null}
          </h3>
          {competency.description ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {competency.description}
            </p>
          ) : null}
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <p>Escala: {competency.scaleName}</p>
          <p>
            Peso: {competency.weightLabel}
            {competency.required ? " · Obligatoria" : " · Opcional"}
          </p>
          {dirty && editable ? (
            <p className="text-amber-700 dark:text-amber-400">
              Cambios sin guardar
            </p>
          ) : null}
        </div>
      </div>

      {editable ? (
        <>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Nivel</legend>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
              {competency.levels.map((level) => {
                const inputId = `${competency.id}-${level.id}`;
                const checked = draft.selectedScaleLevelId === level.id;
                return (
                  <label
                    key={level.id}
                    htmlFor={inputId}
                    className={`flex cursor-pointer gap-3 rounded-md border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-ring ${
                      checked
                        ? "border-primary bg-primary/5"
                        : "border-border bg-muted/30"
                    }`}
                  >
                    <input
                      id={inputId}
                      type="radio"
                      name={`rating-${competency.id}`}
                      value={level.id}
                      checked={checked}
                      onChange={() =>
                        onChange({
                          ...draft,
                          selectedScaleLevelId: level.id,
                        })
                      }
                      className="mt-1"
                    />
                    <span>
                      <span className="font-medium">
                        {level.value} — {level.label}
                      </span>
                      {level.description ? (
                        <span className="mt-1 block text-muted-foreground">
                          {level.description}
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor={`comment-${competency.id}`}>
              Comentario opcional
            </Label>
            <Textarea
              id={`comment-${competency.id}`}
              value={draft.comment}
              maxLength={EVALUATION_COMMENT_MAX_LENGTH}
              onChange={(e) =>
                onChange({ ...draft, comment: e.target.value })
              }
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {draft.comment.length}/{EVALUATION_COMMENT_MAX_LENGTH}
            </p>
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={onSave}
            disabled={saving || !draft.selectedScaleLevelId}
          >
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </>
      ) : (
        <div className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Nivel seleccionado: </span>
            {selectedLevel
              ? `${selectedLevel.value} — ${selectedLevel.label}`
              : "Sin respuesta"}
          </p>
          {competency.response?.comment ? (
            <p>
              <span className="text-muted-foreground">Comentario: </span>
              {competency.response.comment}
            </p>
          ) : null}
          {competency.scoreBreakdown ? (
            <p className="text-muted-foreground">
              Normalizado:{" "}
              {competency.scoreBreakdown.normalizedPercentage.toFixed(2)}%
              {competency.scoreBreakdown.weightedContribution != null
                ? ` · Contribución: ${competency.scoreBreakdown.weightedContribution.toFixed(2)}%`
                : null}
            </p>
          ) : null}
          {!competency.response ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {competency.levels.map((level) => (
                <li
                  key={level.id}
                  className="rounded-md border border-border bg-muted/30 px-3 py-2"
                >
                  <span className="font-medium">
                    {level.value} · {level.label}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </article>
  );
}
