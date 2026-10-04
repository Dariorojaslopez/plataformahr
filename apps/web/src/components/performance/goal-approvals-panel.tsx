"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCompanyId } from "@/hooks/use-company-id";
import { getErrorMessage } from "@/lib/api/errors";
import { performanceApi, performanceKeys } from "@/lib/api/performance";
import { GOAL_PROGRESS_STATUS_LABELS } from "@/lib/performance/goal-progress";
import { formatGoalTarget } from "@/lib/performance/goal-target";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type { GoalProgressStatus } from "@/types/performance";

function personName(row: { firstName: string; lastName: string }) {
  return `${row.firstName} ${row.lastName}`.trim();
}

export function GoalApprovalsPanel({
  cycleId,
  forceReadOnly = false,
}: {
  cycleId: string;
  forceReadOnly?: boolean;
}) {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  const listQuery = useQuery({
    queryKey: performanceKeys.goalApprovals(companyId, cycleId),
    queryFn: () => performanceApi.listGoalApprovals(cycleId),
  });

  const detailQuery = useQuery({
    queryKey: [...performanceKeys.goalApprovals(companyId, cycleId), selectedId],
    queryFn: () => performanceApi.getGoalApproval(cycleId, selectedId!),
    enabled: Boolean(selectedId),
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: performanceKeys.goalApprovals(companyId, cycleId),
    });
  };

  const approveMutation = useMutation({
    mutationFn: () =>
      performanceApi.approveGoalDefinition(cycleId, selectedId!, comment),
    onSuccess: async () => {
      notifySuccess("Objetivos aprobados");
      setComment("");
      await invalidate();
    },
    onError: (error) => notifyError(error, "No se pudo aprobar."),
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      performanceApi.rejectGoalDefinition(cycleId, selectedId!, comment),
    onSuccess: async () => {
      notifySuccess("Definición rechazada");
      setComment("");
      await invalidate();
    },
    onError: (error) => notifyError(error, "No se pudo rechazar."),
  });

  const approveEditMutation = useMutation({
    mutationFn: (requestId: string) =>
      performanceApi.approveGoalEditRequest(cycleId, requestId, comment),
    onSuccess: async () => {
      notifySuccess("Edición habilitada");
      setComment("");
      await invalidate();
    },
    onError: (error) => notifyError(error, "No se pudo habilitar la edición."),
  });

  const rejectEditMutation = useMutation({
    mutationFn: (requestId: string) =>
      performanceApi.rejectGoalEditRequest(cycleId, requestId, comment),
    onSuccess: async () => {
      notifySuccess("Solicitud rechazada");
      setComment("");
      await invalidate();
    },
    onError: (error) => notifyError(error, "No se pudo rechazar la solicitud."),
  });

  const items = listQuery.data?.items ?? [];
  if (listQuery.isError) {
    return (
      <p className="text-sm text-muted-foreground">
        {getErrorMessage(listQuery.error, "No se pudieron cargar las aprobaciones.")}
      </p>
    );
  }
  if (items.length === 0) return null;

  const selected = items.find((item) => item.employee.id === selectedId);
  const pending = selected?.reviewStatus === "PENDING" && Boolean(selected.submittedAt);
  const overdue = Boolean(selected?.overdue);
  const editRequest = selected?.pendingEditRequest;

  return (
    <section className="space-y-4 rounded-lg border border-border p-4">
      <div>
        <h3 className="text-sm font-semibold">Aprobación de objetivos</h3>
        <p className="text-xs text-muted-foreground">
          Revisa los formularios de tus colaboradores. Al aprobar quedan
          bloqueados; al rechazar regresan a edición.
        </p>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.employee.id}>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted/40"
              onClick={() => setSelectedId(item.employee.id)}
            >
              <span>{personName(item.employee)}</span>
              <Badge variant="outline">
                {item.pendingEditRequest
                  ? "Pide edición"
                  : item.overdue
                    ? "Vencida"
                    : item.reviewStatus === "APPROVED"
                      ? "Aprobado"
                      : item.reviewStatus === "REJECTED"
                        ? "Rechazado"
                        : item.submittedAt
                          ? "Pendiente"
                          : "Sin enviar"}
              </Badge>
            </button>
          </li>
        ))}
      </ul>

      {detailQuery.data ? (
        <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
          <p className="font-medium">{personName(detailQuery.data.employee)}</p>
          <ul className="space-y-3 text-sm">
            {detailQuery.data.goals.map((goal) => {
              const target = formatGoalTarget({
                targetValue: goal.targetValue,
                targetScaleLevel: goal.targetScaleLevel,
                scale: goal.scale,
              });
              const assigneeName = goal.assignee
                ? `${goal.assignee.firstName} ${goal.assignee.lastName}`.trim()
                : null;
              const status =
                GOAL_PROGRESS_STATUS_LABELS[
                  goal.progressStatus as GoalProgressStatus
                ] ?? goal.progressStatus;
              return (
                <li key={goal.id} className="space-y-1">
                  <p className="font-medium">{goal.title}</p>
                  {goal.description ? (
                    <p className="text-muted-foreground">{goal.description}</p>
                  ) : null}
                  <p className="text-muted-foreground">
                    Escala: {goal.scale?.name ?? "Sin escala"}
                  </p>
                  <p className="text-muted-foreground">
                    Meta: {target ?? "Sin meta"}
                  </p>
                  <p className="text-muted-foreground">Estado: {status}</p>
                  {goal.parentGoalTitle ? (
                    <p className="text-xs text-muted-foreground">
                      Origen: {goal.parentGoalTitle}
                    </p>
                  ) : null}
                  {assigneeName && goal.assignee?.id !== detailQuery.data.employee.id ? (
                    <p className="text-xs text-muted-foreground">
                      Colaborador: {assigneeName}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {detailQuery.data.pdi ? (
            <div className="text-sm">
              <p className="font-medium">PDI: {detailQuery.data.pdi.name}</p>
              <p className="text-muted-foreground">
                Avance {detailQuery.data.pdi.progressPercent}%
              </p>
            </div>
          ) : null}

          {forceReadOnly ? null : (
            <>
              <div className="space-y-2">
                <Label htmlFor="approval-comment">Comentarios</Label>
                <Textarea
                  id="approval-comment"
                  value={comment}
                  rows={3}
                  onChange={(event) => setComment(event.target.value)}
                />
              </div>
              {overdue ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => rejectMutation.mutate()}
                    disabled={rejectMutation.isPending}
                  >
                    Rechazar
                  </Button>
                </div>
              ) : null}
              {pending ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => approveMutation.mutate()}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                  >
                    Aprobar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => rejectMutation.mutate()}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                  >
                    Rechazar
                  </Button>
                </div>
              ) : null}
              {editRequest ? (
                <div className="space-y-2">
                  <p className="text-sm">
                    Solicitud de edición: {editRequest.comment || "Sin comentario"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => approveEditMutation.mutate(editRequest.id)}
                      disabled={
                        approveEditMutation.isPending || rejectEditMutation.isPending
                      }
                    >
                      Habilitar edición
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => rejectEditMutation.mutate(editRequest.id)}
                      disabled={
                        approveEditMutation.isPending || rejectEditMutation.isPending
                      }
                    >
                      Rechazar edición
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
