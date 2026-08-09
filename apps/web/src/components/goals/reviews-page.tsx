"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
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
  buildApprovePayload,
  buildRejectPayload,
  estimatedAchievementLabel,
  formatAchievementPercent,
} from "@/lib/goals/completion";
import { GOAL_TYPE_LABELS } from "@/lib/goals/labels";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type { GoalCompletionRequest } from "@/types/goals";

export function GoalReviewsPageClient() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<GoalCompletionRequest | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);

  const reviewsQuery = useQuery({
    queryKey: goalKeys.completionReviews(companyId, {
      status: "PENDING",
      page: 1,
      limit: 50,
    }),
    queryFn: () =>
      goalsApi.listCompletionReviews({
        status: "PENDING",
        page: 1,
        limit: 50,
      }),
  });

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: goalKeys.all(companyId) });
  }

  const approveMutation = useMutation({
    mutationFn: () =>
      goalsApi.approveGoalCompletion(
        selected!.id,
        buildApprovePayload(comment),
      ),
    onSuccess: async () => {
      notifySuccess("Objetivo completado");
      setApproveOpen(false);
      setSelected(null);
      setComment("");
      await invalidate();
    },
    onError: (e) => notifyError(e, "No se pudo aprobar"),
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      goalsApi.rejectGoalCompletion(selected!.id, buildRejectPayload(comment)),
    onSuccess: async () => {
      notifySuccess("Solicitud rechazada");
      setRejectOpen(false);
      setSelected(null);
      setComment("");
      await invalidate();
    },
    onError: (e) => notifyError(e, "No se pudo rechazar"),
  });

  const items = reviewsQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revisión de cierres"
        description="Solicitudes PENDING que puedes revisar. El cumplimiento estimado no es el resultado final hasta aprobar."
      />

      {reviewsQuery.isLoading ? <Skeleton className="h-32 w-full" /> : null}
      {reviewsQuery.isError ? (
        <ErrorState
          title="No se pudieron cargar las revisiones"
          description={getErrorMessage(reviewsQuery.error, "Error")}
          onRetry={() => void reviewsQuery.refetch()}
        />
      ) : null}
      {reviewsQuery.isSuccess && items.length === 0 ? (
        <EmptyState
          title="Sin solicitudes pendientes"
          description="Cuando existan solicitudes de cierre que puedas revisar, aparecerán aquí."
        />
      ) : null}

      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="space-y-2 rounded-lg border border-border p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold">
                  {item.goal ? (
                    <Link
                      href={`/goals/${item.goal.id}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {item.goal.title}
                    </Link>
                  ) : (
                    item.goalId
                  )}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {item.goal
                    ? `${GOAL_TYPE_LABELS[item.goal.type]} · ${item.goal.cycle.name}`
                    : ""}
                </p>
              </div>
              <Badge variant="outline">PENDING</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Solicitante:{" "}
              {item.requestedBy
                ? `${item.requestedBy.firstName} ${item.requestedBy.lastName}`
                : "—"}{" "}
              · {new Date(item.requestedAt).toLocaleString("es")}
            </p>
            {item.estimatedAchievement ? (
              <p className="text-sm">
                {estimatedAchievementLabel()}:{" "}
                <span className="font-medium tabular-nums">
                  {formatAchievementPercent(
                    item.estimatedAchievement.achievementPercentage,
                  )}
                </span>
              </p>
            ) : null}
            <Button
              size="sm"
              onClick={() => {
                setSelected(item);
                setComment("");
                setRejectError(null);
              }}
            >
              Revisar
            </Button>
          </li>
        ))}
      </ul>

      <Dialog
        open={!!selected && !approveOpen && !rejectOpen}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revisar cierre</DialogTitle>
          </DialogHeader>
          {selected?.estimatedAchievement ? (
            <p className="text-sm">
              {estimatedAchievementLabel()}:{" "}
              {formatAchievementPercent(
                selected.estimatedAchievement.achievementPercentage,
              )}
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Los valores finales salen del último check-in de cada KR. No se
            editan manualmente.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setApproveOpen(true);
                setComment("");
              }}
            >
              Aprobar y completar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setRejectOpen(true);
                setComment("");
                setRejectError(null);
              }}
            >
              Rechazar cierre
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprobar y completar</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Al aprobar, el objetivo quedará completado y su resultado será
            inmutable.
          </p>
          <div className="space-y-2">
            <Label htmlFor="approve-comment">Comentario (opcional)</Label>
            <Input
              id="approve-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={2000}
            />
          </div>
          <Button
            disabled={approveMutation.isPending}
            onClick={() => approveMutation.mutate()}
          >
            {approveMutation.isPending ? "Aprobando…" : "Aprobar y completar"}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar cierre</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-comment">Comentario (obligatorio)</Label>
            <Input
              id="reject-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={2000}
            />
            {rejectError ? (
              <p className="text-sm text-destructive">{rejectError}</p>
            ) : null}
          </div>
          <Button
            variant="destructive"
            disabled={rejectMutation.isPending}
            onClick={() => {
              try {
                buildRejectPayload(comment);
                setRejectError(null);
                rejectMutation.mutate();
              } catch (e) {
                setRejectError(
                  e instanceof Error ? e.message : "Comentario requerido",
                );
              }
            }}
          >
            {rejectMutation.isPending ? "Rechazando…" : "Rechazar cierre"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
