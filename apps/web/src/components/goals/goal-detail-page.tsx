"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { CheckInDialog } from "@/components/goals/check-in-dialog";
import { CheckInHistoryList } from "@/components/goals/check-in-history";
import { GoalProgressBar } from "@/components/goals/progress-bar";
import { FormSelect } from "@/components/organization/form-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCompanyId } from "@/hooks/use-company-id";
import { getErrorMessage } from "@/lib/api/errors";
import { goalKeys, goalsApi } from "@/lib/api/goals";
import { organizationApi, orgKeys } from "@/lib/api/organization";
import {
  buildActivationChecklist,
  canActivateFromChecklist,
} from "@/lib/goals/activation";
import {
  DIRECTION_LABELS,
  GOAL_STATUS_LABELS,
  GOAL_TYPE_LABELS,
  METRIC_TYPE_LABELS,
  formatKeyResultTarget,
  goalStatusVariant,
} from "@/lib/goals/labels";
import {
  buildRequestCompletionPayload,
  finalAchievementLabel,
  formatAchievementPercent,
} from "@/lib/goals/completion";
import { formatCurrentValue } from "@/lib/goals/progress";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type {
  CreateKeyResultInput,
  GoalKeyResultProgress,
  GoalMetricDirection,
  GoalMetricType,
} from "@/types/goals";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function GoalDetailPageClient() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const params = useParams<{ id: string }>();
  const goalId = params.id;
  const [krForm, setKrForm] = useState<CreateKeyResultInput>({
    title: "",
    metricType: "NUMBER",
    direction: "INCREASE",
    startValue: 0,
    targetValue: 100,
    unit: "",
  });
  const [employeeId, setEmployeeId] = useState("");
  const [activeKr, setActiveKr] = useState<GoalKeyResultProgress | null>(null);
  const [historyKrId, setHistoryKrId] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestComment, setRequestComment] = useState("");

  const goalQuery = useQuery({
    queryKey: goalKeys.goal(companyId, goalId),
    queryFn: () => goalsApi.getGoal(goalId),
  });

  const historyQuery = useQuery({
    queryKey: historyKrId
      ? goalKeys.checkIns(companyId, goalId, historyKrId, {
          page: 1,
          limit: 20,
        })
      : ["goals", companyId, "checkIns", "idle"],
    queryFn: () =>
      goalsApi.getKeyResultCheckIns(goalId, historyKrId!, {
        page: 1,
        limit: 20,
      }),
    enabled: !!historyKrId,
  });

  const resultQuery = useQuery({
    queryKey: goalKeys.result(companyId, goalId),
    queryFn: () => goalsApi.getGoalResult(goalId),
    enabled: goalQuery.data?.status === "COMPLETED",
    retry: false,
  });

  const completionHistoryQuery = useQuery({
    queryKey: goalKeys.completionRequests(companyId, goalId),
    queryFn: () => goalsApi.getGoalCompletionRequests(goalId),
    enabled: !!goalQuery.data,
  });

  const employeesQuery = useQuery({
    queryKey: orgKeys.employees(companyId, { page: 1, limit: 100 }),
    queryFn: () => organizationApi.listEmployees({ page: 1, limit: 100 }),
    enabled: goalQuery.data?.status === "DRAFT",
  });

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: goalKeys.all(companyId) });
  }

  const activateMutation = useMutation({
    mutationFn: () => goalsApi.activateGoal(goalId),
    onSuccess: async () => {
      await invalidate();
      notifySuccess("Objetivo activado");
    },
    onError: (e) => notifyError(e, "No se pudo activar."),
  });
  const cancelMutation = useMutation({
    mutationFn: () => goalsApi.cancelGoal(goalId),
    onSuccess: async () => {
      await invalidate();
      notifySuccess("Objetivo cancelado");
    },
    onError: (e) => notifyError(e, "No se pudo cancelar."),
  });
  const createKrMutation = useMutation({
    mutationFn: () => goalsApi.createKeyResult(goalId, krForm),
    onSuccess: async () => {
      await invalidate();
      setKrForm({
        title: "",
        metricType: "NUMBER",
        direction: "INCREASE",
        startValue: 0,
        targetValue: 100,
        unit: "",
      });
      notifySuccess("Key Result creado");
    },
    onError: (e) => notifyError(e, "No se pudo crear el KR."),
  });
  const deleteKrMutation = useMutation({
    mutationFn: (krId: string) => goalsApi.deleteKeyResult(goalId, krId),
    onSuccess: async () => {
      await invalidate();
      notifySuccess("Key Result eliminado");
    },
    onError: (e) => notifyError(e, "No se pudo eliminar."),
  });
  const addAssignmentMutation = useMutation({
    mutationFn: () => goalsApi.addAssignment(goalId, employeeId),
    onSuccess: async () => {
      await invalidate();
      setEmployeeId("");
      notifySuccess("Responsable asignado");
    },
    onError: (e) => notifyError(e, "No se pudo asignar."),
  });
  const removeAssignmentMutation = useMutation({
    mutationFn: (assignmentId: string) =>
      goalsApi.removeAssignment(goalId, assignmentId),
    onSuccess: async () => {
      await invalidate();
      notifySuccess("Asignación eliminada");
    },
    onError: (e) => notifyError(e, "No se pudo quitar."),
  });

  const checkInMutation = useMutation({
    mutationFn: (body: {
      numericValue?: number;
      booleanValue?: boolean;
      comment?: string | null;
      evidenceReference?: string | null;
    }) =>
      goalsApi.createKeyResultCheckIn(goalId, activeKr!.keyResultId, body),
    onSuccess: async () => {
      notifySuccess("Avance registrado");
      setActiveKr(null);
      await invalidate();
      if (historyKrId) {
        await queryClient.invalidateQueries({
          queryKey: goalKeys.checkIns(companyId, goalId, historyKrId, {
            page: 1,
            limit: 20,
          }),
        });
      }
    },
    onError: (e) => notifyError(e, "No se pudo registrar el avance."),
  });

  const requestCompletionMutation = useMutation({
    mutationFn: () =>
      goalsApi.requestGoalCompletion(
        goalId,
        buildRequestCompletionPayload(requestComment),
      ),
    onSuccess: async () => {
      notifySuccess("Solicitud de cierre enviada");
      setRequestOpen(false);
      setRequestComment("");
      await invalidate();
    },
    onError: (e) => notifyError(e, "No se pudo solicitar el cierre."),
  });

  if (goalQuery.isLoading) return <Skeleton className="h-48 w-full" />;
  if (goalQuery.isError) {
    return (
      <ErrorState
        title="No se pudo cargar el objetivo"
        description={getErrorMessage(goalQuery.error, "Error")}
        onRetry={() => void goalQuery.refetch()}
      />
    );
  }

  const goal = goalQuery.data!;
  const draft = goal.status === "DRAFT";
  const checks = buildActivationChecklist({
    goal,
    cycleStatus: goal.cycle.status,
  });
  const assignedIds = new Set(goal.assignments.map((a) => a.employeeId));
  const employeeOptions = (employeesQuery.data?.items ?? [])
    .filter((e) => !assignedIds.has(e.id))
    .map((e) => ({
      value: e.id,
      label: `${e.firstName} ${e.lastName}`.trim(),
    }));

  return (
    <div className="space-y-8">
      <div>
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link href="/goals">
            <ArrowLeft className="h-4 w-4" />
            Objetivos
          </Link>
        </Button>
      </div>
      <PageHeader
        title={goal.title}
        description={`${GOAL_TYPE_LABELS[goal.type]} · ${goal.cycle.name}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {draft ? (
              <Button
                type="button"
                disabled={
                  !canActivateFromChecklist(checks) || activateMutation.isPending
                }
                onClick={() => {
                  if (confirm("¿Activar objetivo? La estructura quedará congelada."))
                    activateMutation.mutate();
                }}
              >
                {activateMutation.isPending ? "Activando…" : "Activar"}
              </Button>
            ) : null}
            {goal.status === "DRAFT" || goal.status === "ACTIVE" ? (
              <Button
                type="button"
                variant="destructive"
                disabled={cancelMutation.isPending}
                onClick={() => {
                  if (confirm("¿Cancelar objetivo?")) cancelMutation.mutate();
                }}
              >
                {cancelMutation.isPending ? "Cancelando…" : "Cancelar"}
              </Button>
            ) : null}
          </div>
        }
      />
      <div className="flex flex-wrap gap-2">
        <Badge variant={goalStatusVariant(goal.status)}>
          {GOAL_STATUS_LABELS[goal.status]}
        </Badge>
        {goal.area ? <Badge variant="outline">{goal.area.name}</Badge> : null}
      </div>

      {goal.status === "ACTIVE" && goal.progress ? (
        <section className="space-y-4" aria-label="Seguimiento">
          <h2 className="text-lg font-semibold">Seguimiento</h2>
          <p className="text-sm text-muted-foreground">
            Progreso operacional derivado de check-ins. No es score final ni
            rating de desempeño.
          </p>
          <GoalProgressBar value={goal.progress.progressPercentage} />
          <ul className="space-y-4">
            {goal.progress.keyResults.map((kr) => (
              <li
                key={kr.keyResultId}
                className="space-y-2 rounded-lg border border-border p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{kr.title}</span>
                  <span className="tabular-nums text-sm">
                    {kr.progressPercentage} %
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
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
                <GoalProgressBar value={kr.progressPercentage} label="KR" />
                <div className="flex flex-wrap gap-2">
                  {goal.canCheckIn ? (
                    <Button size="sm" onClick={() => setActiveKr(kr)}>
                      Registrar avance
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setHistoryKrId(kr.keyResultId)}
                  >
                    Historial de avances
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {historyKrId ? (
            <div className="rounded-lg border border-border p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-medium">Historial de avances</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setHistoryKrId(null)}
                >
                  Cerrar
                </Button>
              </div>
              {historyQuery.isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <CheckInHistoryList items={historyQuery.data?.items ?? []} />
              )}
            </div>
          ) : null}
          {activeKr ? (
            <CheckInDialog
              open={!!activeKr}
              onOpenChange={(open) => {
                if (!open) setActiveKr(null);
              }}
              keyResult={activeKr}
              pending={checkInMutation.isPending}
              onSubmit={(body) => checkInMutation.mutate(body)}
            />
          ) : null}
          {goal.canRequestCompletion ? (
            <Button size="sm" variant="secondary" onClick={() => setRequestOpen(true)}>
              Solicitar cierre
            </Button>
          ) : null}
          {goal.pendingCompletionRequest ? (
            <p className="text-sm text-muted-foreground">
              En revisión de cierre desde{" "}
              {new Date(
                goal.pendingCompletionRequest.requestedAt,
              ).toLocaleString("es")}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-3" aria-label="Cierre y resultado">
        <h2 className="text-lg font-semibold">Cierre / Resultado</h2>
        {goal.status === "COMPLETED" && resultQuery.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : null}
        {goal.status === "COMPLETED" && resultQuery.isError ? (
          <ErrorState
            title="No se pudo cargar el resultado formal"
            description={getErrorMessage(resultQuery.error, "Error")}
            onRetry={() => void resultQuery.refetch()}
          />
        ) : null}
        {goal.status === "COMPLETED" && resultQuery.data ? (
          <div className="space-y-3 rounded-lg border border-border p-4">
            <p className="text-base font-medium tabular-nums">
              {finalAchievementLabel()}:{" "}
              {formatAchievementPercent(
                resultQuery.data.achievementPercentage,
              )}
            </p>
            <ul className="space-y-2 text-sm">
              {resultQuery.data.keyResults.map((kr) => (
                <li key={kr.id} className="border-t border-border pt-2">
                  <p className="font-medium">{kr.title}</p>
                  <p className="text-muted-foreground">
                    Inicial: {kr.startNumericValue ?? (kr.metricType === "BOOLEAN" ? "—" : "0")}
                    {" · Meta: "}
                    {kr.metricType === "BOOLEAN"
                      ? kr.targetBoolean
                        ? "Cumplir"
                        : "No cumplir"
                      : kr.targetNumericValue}
                    {" · Final: "}
                    {kr.metricType === "BOOLEAN"
                      ? kr.finalBooleanValue
                        ? "Sí"
                        : "No"
                      : kr.finalNumericValue}
                    {" · Cumplimiento: "}
                    {formatAchievementPercent(kr.achievementPercentage)}
                    {kr.effectiveWeight
                      ? ` · Peso efectivo: ${kr.effectiveWeight}`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
            {resultQuery.data.completionRequest?.reviewComment ? (
              <p className="text-sm">
                Comentario de revisión:{" "}
                {resultQuery.data.completionRequest.reviewComment}
              </p>
            ) : null}
          </div>
        ) : null}
        {goal.status !== "COMPLETED" ? (
          <p className="text-sm text-muted-foreground">
            El resultado formal aparece cuando el cierre se aprueba.
          </p>
        ) : null}
        {(completionHistoryQuery.data?.items.length ?? 0) > 0 ? (
          <ul className="space-y-2 text-sm">
            {completionHistoryQuery.data!.items.map((r) => (
              <li key={r.id} className="rounded border border-border px-3 py-2">
                {r.status} · {new Date(r.requestedAt).toLocaleString("es")}
                {r.reviewComment ? ` · ${r.reviewComment}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar cierre</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Al solicitar el cierre, no podrás registrar nuevos avances mientras
            la solicitud esté en revisión.
          </p>
          <div className="space-y-2">
            <Label htmlFor="detail-req-comment">Comentario (opcional)</Label>
            <Input
              id="detail-req-comment"
              value={requestComment}
              onChange={(e) => setRequestComment(e.target.value)}
              maxLength={2000}
            />
          </div>
          <Button
            disabled={requestCompletionMutation.isPending}
            onClick={() => requestCompletionMutation.mutate()}
          >
            Solicitar cierre
          </Button>
        </DialogContent>
      </Dialog>

      <section className="space-y-2" aria-label="Checklist de activación">
        <h2 className="text-lg font-semibold">Listo para activar</h2>
        <ul className="space-y-1 text-sm">
          {checks.map((c) => (
            <li key={c.key} className={c.ok ? "text-foreground" : "text-muted-foreground"}>
              {c.ok ? "✓" : "○"} {c.label}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          El backend valida la activación; esta lista es orientativa.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Key Results</h2>
        {goal.keyResults.length === 0 ? (
          <EmptyState
            title="Sin Key Results"
            description="Agrega al menos uno antes de activar."
          />
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Métrica</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Peso</TableHead>
                  {draft ? <TableHead /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {goal.keyResults.map((kr) => (
                  <TableRow key={kr.id}>
                    <TableCell>{kr.title}</TableCell>
                    <TableCell>
                      {METRIC_TYPE_LABELS[kr.metricType]}
                      {kr.direction
                        ? ` · ${DIRECTION_LABELS[kr.direction]}`
                        : ""}
                    </TableCell>
                    <TableCell>{formatKeyResultTarget(kr)}</TableCell>
                    <TableCell>{kr.weight ?? "—"}</TableCell>
                    {draft ? (
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label="Eliminar Key Result"
                          onClick={() => deleteKrMutation.mutate(kr.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {draft ? (
          <div className="space-y-3 rounded-lg border p-4">
            <p className="font-medium">Agregar Key Result</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="kr-title">Título</Label>
                <Input
                  id="kr-title"
                  value={krForm.title}
                  onChange={(e) =>
                    setKrForm((f) => ({ ...f, title: e.target.value }))
                  }
                />
              </div>
              <FormSelect
                id="kr-type"
                label="Tipo de métrica"
                value={krForm.metricType}
                onChange={(metricType) =>
                  setKrForm((f) => ({
                    ...f,
                    metricType: metricType as GoalMetricType,
                    ...(metricType === "BOOLEAN"
                      ? {
                          direction: null,
                          targetValue: null,
                          startValue: null,
                          targetBoolean: true,
                          currencyCode: null,
                        }
                      : {
                          direction: "INCREASE",
                          targetBoolean: null,
                          targetValue: f.targetValue ?? 100,
                        }),
                  }))
                }
                options={Object.entries(METRIC_TYPE_LABELS).map(
                  ([value, label]) => ({ value, label }),
                )}
              />
              {krForm.metricType !== "BOOLEAN" ? (
                <FormSelect
                  id="kr-dir"
                  label="Dirección"
                  value={krForm.direction ?? "INCREASE"}
                  onChange={(direction) =>
                    setKrForm((f) => ({
                      ...f,
                      direction: direction as GoalMetricDirection,
                    }))
                  }
                  options={Object.entries(DIRECTION_LABELS).map(
                    ([value, label]) => ({ value, label }),
                  )}
                />
              ) : null}
              {krForm.metricType !== "BOOLEAN" ? (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="kr-start">Inicio</Label>
                    <Input
                      id="kr-start"
                      type="number"
                      value={krForm.startValue ?? ""}
                      onChange={(e) =>
                        setKrForm((f) => ({
                          ...f,
                          startValue:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="kr-target">Target</Label>
                    <Input
                      id="kr-target"
                      type="number"
                      value={krForm.targetValue ?? ""}
                      onChange={(e) =>
                        setKrForm((f) => ({
                          ...f,
                          targetValue:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                </>
              ) : null}
              {krForm.metricType === "CURRENCY" ? (
                <div className="space-y-1">
                  <Label htmlFor="kr-cur">Moneda (ISO)</Label>
                  <Input
                    id="kr-cur"
                    maxLength={3}
                    value={krForm.currencyCode ?? ""}
                    onChange={(e) =>
                      setKrForm((f) => ({
                        ...f,
                        currencyCode: e.target.value.toUpperCase(),
                      }))
                    }
                  />
                </div>
              ) : null}
              {krForm.metricType === "NUMBER" ? (
                <div className="space-y-1">
                  <Label htmlFor="kr-unit">Unidad</Label>
                  <Input
                    id="kr-unit"
                    value={krForm.unit ?? ""}
                    onChange={(e) =>
                      setKrForm((f) => ({ ...f, unit: e.target.value }))
                    }
                  />
                </div>
              ) : null}
              <div className="space-y-1">
                <Label htmlFor="kr-weight">Peso</Label>
                <Input
                  id="kr-weight"
                  type="number"
                  value={krForm.weight ?? ""}
                  onChange={(e) =>
                    setKrForm((f) => ({
                      ...f,
                      weight:
                        e.target.value === ""
                          ? null
                          : Number(e.target.value),
                    }))
                  }
                />
              </div>
            </div>
            <Button
              type="button"
              onClick={() => createKrMutation.mutate()}
              disabled={createKrMutation.isPending}
            >
              <Plus className="h-4 w-4" />
              Agregar KR
            </Button>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Responsables</h2>
        <p className="text-sm text-muted-foreground">
          Asignaciones explícitas a colaboradores. Los objetivos AREA/COMPANY no
          materializan automáticamente a todo el área o compañía.
        </p>
        {goal.assignments.length === 0 ? (
          <EmptyState
            title="Sin responsables"
            description={
              goal.type === "INDIVIDUAL"
                ? "Asigna al menos uno para poder activar."
                : "Opcional para objetivos de área o compañía."
            }
          />
        ) : (
          <ul className="space-y-2">
            {goal.assignments.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <span>
                  {a.employee.firstName} {a.employee.lastName}
                </span>
                {draft ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Quitar responsable"
                    onClick={() => removeAssignmentMutation.mutate(a.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {draft ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <FormSelect
              id="assign-emp"
              label="Colaborador"
              className="flex-1"
              value={employeeId}
              onChange={setEmployeeId}
              options={employeeOptions}
            />
            <Button
              type="button"
              disabled={!employeeId || addAssignmentMutation.isPending}
              onClick={() => addAssignmentMutation.mutate()}
            >
              Asignar
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
