"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { CheckInDialog } from "@/components/goals/check-in-dialog";
import { CheckInHistoryList } from "@/components/goals/check-in-history";
import { GoalProgressBar } from "@/components/goals/progress-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyId } from "@/hooks/use-company-id";
import { getErrorMessage } from "@/lib/api/errors";
import { goalKeys, goalsApi } from "@/lib/api/goals";
import {
  buildRequestCompletionPayload,
  formatAchievementPercent,
} from "@/lib/goals/completion";
import {
  GOAL_TYPE_LABELS,
  formatKeyResultTarget,
  goalStatusVariant,
  GOAL_STATUS_LABELS,
} from "@/lib/goals/labels";
import { formatCurrentValue } from "@/lib/goals/progress";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type { Goal, GoalKeyResultProgress } from "@/types/goals";

export function MyGoalsPageClient() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const [activeKr, setActiveKr] = useState<{
    goal: Goal;
    kr: GoalKeyResultProgress;
  } | null>(null);
  const [historyKr, setHistoryKr] = useState<{
    goalId: string;
    keyResultId: string;
  } | null>(null);
  const [requestGoal, setRequestGoal] = useState<Goal | null>(null);
  const [requestComment, setRequestComment] = useState("");

  const mineQuery = useQuery({
    queryKey: goalKeys.mine(companyId),
    queryFn: () => goalsApi.listMine(),
  });

  const historyQuery = useQuery({
    queryKey: historyKr
      ? goalKeys.checkIns(companyId, historyKr.goalId, historyKr.keyResultId, {
          page: 1,
          limit: 20,
        })
      : ["goals", companyId, "checkIns", "idle"],
    queryFn: () =>
      goalsApi.getKeyResultCheckIns(historyKr!.goalId, historyKr!.keyResultId, {
        page: 1,
        limit: 20,
      }),
    enabled: !!historyKr,
  });

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: goalKeys.all(companyId) });
  }

  const checkInMutation = useMutation({
    mutationFn: (body: {
      numericValue?: number;
      booleanValue?: boolean;
      comment?: string | null;
      evidenceReference?: string | null;
    }) =>
      goalsApi.createKeyResultCheckIn(
        activeKr!.goal.id,
        activeKr!.kr.keyResultId,
        body,
      ),
    onSuccess: async () => {
      notifySuccess("Avance registrado");
      setActiveKr(null);
      await invalidate();
    },
    onError: (err) => notifyError(err, "No se pudo registrar el avance"),
  });

  const requestMutation = useMutation({
    mutationFn: () =>
      goalsApi.requestGoalCompletion(
        requestGoal!.id,
        buildRequestCompletionPayload(requestComment),
      ),
    onSuccess: async () => {
      notifySuccess("Solicitud de cierre enviada");
      setRequestGoal(null);
      setRequestComment("");
      await invalidate();
    },
    onError: (err) => notifyError(err, "No se pudo solicitar el cierre"),
  });

  const items = mineQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mis objetivos"
        description="Seguimiento operacional (ACTIVE) y cumplimiento final (COMPLETED). El progreso no es un score de desempeño."
      />

      {mineQuery.isLoading ? <Skeleton className="h-32 w-full" /> : null}
      {mineQuery.isError ? (
        <ErrorState
          title="No se pudieron cargar tus objetivos"
          description={getErrorMessage(mineQuery.error, "Error")}
          onRetry={() => void mineQuery.refetch()}
        />
      ) : null}
      {mineQuery.isSuccess && items.length === 0 ? (
        <EmptyState
          title="Sin objetivos"
          description="Cuando te apliquen objetivos ACTIVE o COMPLETED, aparecerán aquí."
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((goal) => {
          const pending = goal.pendingCompletionRequest;
          const completed = goal.status === "COMPLETED";
          return (
            <article
              key={goal.id}
              className="space-y-3 rounded-lg border border-border p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">
                    <Link
                      href={`/goals/${goal.id}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {goal.title}
                    </Link>
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {GOAL_TYPE_LABELS[goal.type]} · {goal.cycle.name}
                    {goal.area ? ` · ${goal.area.name}` : ""}
                  </p>
                </div>
                <Badge variant={goalStatusVariant(goal.status)}>
                  {GOAL_STATUS_LABELS[goal.status]}
                </Badge>
              </div>

              {pending ? (
                <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                  En revisión de cierre · solicitado{" "}
                  {new Date(pending.requestedAt).toLocaleString("es")}
                </p>
              ) : null}

              {goal.latestRejection && !pending && !completed ? (
                <p className="rounded-md border border-border px-3 py-2 text-sm">
                  Último rechazo:{" "}
                  {goal.latestRejection.reviewComment ?? "Sin detalle"}
                </p>
              ) : null}

              {completed ? (
                <p className="text-sm font-medium tabular-nums">
                  Cumplimiento final:{" "}
                  {formatAchievementPercent(goal.achievementPercentage)}
                </p>
              ) : goal.progress ? (
                <GoalProgressBar value={goal.progress.progressPercentage} />
              ) : null}

              {!completed ? (
                <ul className="space-y-3">
                  {(goal.progress?.keyResults ?? []).map((kr) => (
                    <li key={kr.keyResultId} className="space-y-1 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{kr.title}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {kr.progressPercentage} %
                        </span>
                      </div>
                      <p className="text-muted-foreground">
                        Actual:{" "}
                        {formatCurrentValue({
                          metricType: kr.metricType,
                          currentNumericValue: kr.currentNumericValue,
                          currentBooleanValue: kr.currentBooleanValue,
                          currencyCode: kr.currencyCode,
                          unit: kr.unit,
                        })}
                        {" · Meta: "}
                        {formatKeyResultTarget(kr)}
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {goal.canCheckIn ? (
                          <Button
                            size="sm"
                            onClick={() => setActiveKr({ goal, kr })}
                          >
                            Registrar avance
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Solo lectura / sin avances durante revisión
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setHistoryKr({
                              goalId: goal.id,
                              keyResultId: kr.keyResultId,
                            })
                          }
                        >
                          Historial de avances
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Resultado formal inmutable. Consulta el detalle para el
                  snapshot de Key Results.
                </p>
              )}

              {goal.canRequestCompletion ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setRequestGoal(goal)}
                >
                  Solicitar cierre
                </Button>
              ) : null}
            </article>
          );
        })}
      </div>

      {activeKr ? (
        <CheckInDialog
          open={!!activeKr}
          onOpenChange={(open) => {
            if (!open) setActiveKr(null);
          }}
          keyResult={activeKr.kr}
          pending={checkInMutation.isPending}
          onSubmit={(body) => checkInMutation.mutate(body)}
        />
      ) : null}

      <Dialog
        open={!!requestGoal}
        onOpenChange={(open) => {
          if (!open) setRequestGoal(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar cierre</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Al solicitar el cierre, no podrás registrar nuevos avances mientras
            la solicitud esté en revisión.
          </p>
          <div className="space-y-2">
            <Label htmlFor="req-comment">Comentario (opcional)</Label>
            <Input
              id="req-comment"
              value={requestComment}
              onChange={(e) => setRequestComment(e.target.value)}
              maxLength={2000}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setRequestGoal(null)}
              disabled={requestMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              disabled={requestMutation.isPending}
              onClick={() => requestMutation.mutate()}
            >
              {requestMutation.isPending
                ? "Enviando…"
                : "Solicitar cierre"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {historyKr ? (
        <div className="rounded-lg border border-border p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-semibold">Historial de avances</h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setHistoryKr(null)}
            >
              Cerrar
            </Button>
          </div>
          {historyQuery.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <CheckInHistoryList items={historyQuery.data?.items ?? []} />
          )}
        </div>
      ) : null}
    </div>
  );
}
