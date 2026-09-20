"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type Dispatch, type SetStateAction, useState } from "react";
import { useSession } from "@/components/auth/session-provider";
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
import { Textarea } from "@/components/ui/textarea";
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
import { canManageOrganizationalGoals } from "@/lib/goals/organizational-form";
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
import {
  calculateOrganizationalKeyResultProgress,
  formatCurrentValue,
} from "@/lib/goals/progress";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type {
  CreateKeyResultInput,
  Goal,
  GoalCheckIn,
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
  const { companyAccess } = useSession();
  const canManageOrgGoals = canManageOrganizationalGoals(
    companyAccess?.roleCodes,
  );
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
  const [titleDraft, setTitleDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [krDrafts, setKrDrafts] = useState<
    Record<string, { meta: string; result: string }>
  >({});
  const [draftSeed, setDraftSeed] = useState<string | null>(null);

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

  const updateGoalMutation = useMutation({
    mutationFn: () =>
      goalsApi.updateGoal(goalId, {
        title: titleDraft.trim(),
        description: descriptionDraft.trim() || null,
      }),
    onSuccess: async () => {
      await invalidate();
      notifySuccess("Objetivo actualizado");
    },
    onError: (e) => notifyError(e, "No se pudo actualizar el objetivo."),
  });

  const saveTrackingMutation = useMutation({
    mutationFn: async (input: {
      keyResultId: string;
      meta?: number | null;
      result?: number;
      booleanResult?: boolean;
    }) => {
      if (input.meta !== undefined) {
        await goalsApi.updateKeyResult(goalId, input.keyResultId, {
          targetValue: input.meta,
        });
      }
      if (input.result !== undefined) {
        await goalsApi.createKeyResultCheckIn(goalId, input.keyResultId, {
          numericValue: input.result,
        });
      }
      if (input.booleanResult !== undefined) {
        await goalsApi.createKeyResultCheckIn(goalId, input.keyResultId, {
          booleanValue: input.booleanResult,
        });
      }
    },
    onSuccess: async () => {
      notifySuccess("Meta y resultado guardados");
      await invalidate();
    },
    onError: (e) => notifyError(e, "No se pudo guardar el seguimiento."),
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

  const loadedGoal = goalQuery.data;
  if (loadedGoal && draftSeed !== loadedGoal.updatedAt) {
    setDraftSeed(loadedGoal.updatedAt);
    setTitleDraft(loadedGoal.title);
    setDescriptionDraft(loadedGoal.description ?? "");
    setKrDrafts(krDraftsFromGoal(loadedGoal));
  }

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
  const structureLocked =
    goal.type === "COMPANY" && !canManageOrgGoals;
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
            Objetivos organizacionales
          </Link>
        </Button>
      </div>
      <PageHeader
        title={goal.title}
        description={`${GOAL_TYPE_LABELS[goal.type]} · ${goal.cycle.name}`}
        actions={
          structureLocked ? undefined : (
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
          )
        }
      />
      <div className="flex flex-wrap gap-2">
        <Badge variant={goalStatusVariant(goal.status)}>
          {GOAL_STATUS_LABELS[goal.status]}
        </Badge>
        {goal.area ? <Badge variant="outline">{goal.area.name}</Badge> : null}
      </div>

      {canManageOrgGoals &&
      (goal.status === "DRAFT" || goal.status === "ACTIVE") ? (
        <section className="space-y-4 rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold">Datos del objetivo</h2>
          <div className="space-y-2">
            <Label htmlFor="org-goal-title">Título</Label>
            <Input
              id="org-goal-title"
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-goal-desc">Descripción</Label>
            <Textarea
              id="org-goal-desc"
              rows={3}
              value={descriptionDraft}
              onChange={(event) => setDescriptionDraft(event.target.value)}
            />
          </div>
          <Button
            type="button"
            size="sm"
            disabled={updateGoalMutation.isPending}
            onClick={() => updateGoalMutation.mutate()}
          >
            Guardar objetivo
          </Button>
          {goal.status === "ACTIVE" && goal.progress ? (
            <GoalTrackingFields
              goal={goal}
              krDrafts={krDrafts}
              setKrDrafts={setKrDrafts}
              canManageOrgGoals={canManageOrgGoals}
              historyKrId={historyKrId}
              setHistoryKrId={setHistoryKrId}
              setActiveKr={setActiveKr}
              historyLoading={historyQuery.isLoading}
              historyItems={historyQuery.data?.items ?? []}
              savePending={saveTrackingMutation.isPending}
              onSave={(input) => saveTrackingMutation.mutate(input)}
              onRequestClose={() => setRequestOpen(true)}
            />
          ) : null}
        </section>
      ) : goal.status === "ACTIVE" && goal.progress ? (
        <section className="space-y-4 rounded-lg border border-border p-4">
          <GoalTrackingFields
            goal={goal}
            krDrafts={krDrafts}
            setKrDrafts={setKrDrafts}
            canManageOrgGoals={canManageOrgGoals}
            historyKrId={historyKrId}
            setHistoryKrId={setHistoryKrId}
            setActiveKr={setActiveKr}
            historyLoading={historyQuery.isLoading}
            historyItems={historyQuery.data?.items ?? []}
            savePending={saveTrackingMutation.isPending}
            onSave={(input) => saveTrackingMutation.mutate(input)}
            onRequestClose={() => setRequestOpen(true)}
          />
        </section>
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
                    {draft && !structureLocked ? <TableHead /> : null}
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
                    {draft && !structureLocked ? (
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

        {draft && !structureLocked ? (
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
                    <Label htmlFor="kr-start">Valor inicial</Label>
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
                {draft && !structureLocked ? (
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
        {draft && !structureLocked ? (
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

function GoalTrackingFields({
  goal,
  krDrafts,
  setKrDrafts,
  canManageOrgGoals,
  historyKrId,
  setHistoryKrId,
  setActiveKr,
  historyLoading,
  historyItems,
  savePending,
  onSave,
  onRequestClose,
}: {
  goal: Goal;
  krDrafts: Record<string, { meta: string; result: string }>;
  setKrDrafts: Dispatch<
    SetStateAction<Record<string, { meta: string; result: string }>>
  >;
  canManageOrgGoals: boolean;
  historyKrId: string | null;
  setHistoryKrId: (id: string | null) => void;
  setActiveKr: (kr: GoalKeyResultProgress | null) => void;
  historyLoading: boolean;
  historyItems: GoalCheckIn[];
  savePending: boolean;
  onSave: (input: {
    keyResultId: string;
    meta?: number | null;
    result?: number;
    booleanResult?: boolean;
  }) => void;
  onRequestClose: () => void;
}) {
  const keyResults = goal.progress?.keyResults ?? [];
  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div>
        <h3 className="text-sm font-semibold">Seguimiento</h3>
        <p className="text-xs text-muted-foreground">
          Meta y resultado del objetivo. El cumplimiento se calcula solo.
        </p>
      </div>
      <ul className="space-y-4">
        {keyResults.map((kr) => {
          const draft = krDrafts[kr.keyResultId] ?? {
            meta: kr.targetValue ?? "",
            result: kr.currentNumericValue ?? "",
          };
          const metaNumber = parseTrackingNumber(draft.meta);
          const resultNumber = parseTrackingNumber(draft.result);
          const livePercent =
            goal.type === "COMPANY" || goal.type === "AREA"
              ? calculateOrganizationalKeyResultProgress({
                  metricType: kr.metricType,
                  direction: kr.direction,
                  startValue:
                    kr.startValue != null ? Number(kr.startValue) : null,
                  targetValue: metaNumber,
                  currentNumericValue: resultNumber,
                  currentBooleanValue: kr.currentBooleanValue,
                  hasCheckIn:
                    kr.metricType === "BOOLEAN"
                      ? kr.lastCheckInAt != null
                      : resultNumber != null,
                })
              : kr.progressPercentage;
          const canEditValues = canManageOrgGoals || Boolean(goal.canCheckIn);
          return (
            <li key={kr.keyResultId} className="space-y-3">
              {kr.metricType === "BOOLEAN" ? (
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
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`kr-meta-${kr.keyResultId}`}>Meta</Label>
                    <div className="relative">
                      {kr.metricType === "CURRENCY" && kr.currencyCode ? (
                        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                          {kr.currencyCode}
                        </span>
                      ) : null}
                      <Input
                        id={`kr-meta-${kr.keyResultId}`}
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        disabled={!canEditValues}
                        className={
                          kr.metricType === "CURRENCY" && kr.currencyCode
                            ? "pl-14"
                            : undefined
                        }
                        value={draft.meta}
                        onChange={(event) =>
                          setKrDrafts((current) => ({
                            ...current,
                            [kr.keyResultId]: {
                              ...draft,
                              meta: event.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`kr-result-${kr.keyResultId}`}>
                      Resultado
                    </Label>
                    <div className="relative">
                      {kr.metricType === "CURRENCY" && kr.currencyCode ? (
                        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                          {kr.currencyCode}
                        </span>
                      ) : null}
                      <Input
                        id={`kr-result-${kr.keyResultId}`}
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        disabled={!goal.canCheckIn}
                        className={
                          kr.metricType === "CURRENCY" && kr.currencyCode
                            ? "pl-14"
                            : undefined
                        }
                        value={draft.result}
                        onChange={(event) =>
                          setKrDrafts((current) => ({
                            ...current,
                            [kr.keyResultId]: {
                              ...draft,
                              result: event.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              )}
              <GoalProgressBar value={livePercent} label="Cumplimiento" />
              <div className="flex flex-wrap gap-2">
                {kr.metricType !== "BOOLEAN" && canEditValues ? (
                  <Button
                    size="sm"
                    disabled={savePending}
                    onClick={() => {
                      if (metaNumber == null) {
                        notifyError(
                          new Error("La meta debe ser un número."),
                          "La meta debe ser un número.",
                        );
                        return;
                      }
                      if (resultNumber == null) {
                        notifyError(
                          new Error("El resultado debe ser un número."),
                          "El resultado debe ser un número.",
                        );
                        return;
                      }
                      const previousMeta = parseTrackingNumber(
                        kr.targetValue ?? "",
                      );
                      const previousResult = parseTrackingNumber(
                        kr.currentNumericValue ?? "",
                      );
                      const metaChanged =
                        canManageOrgGoals && metaNumber !== previousMeta;
                      const resultChanged =
                        Boolean(goal.canCheckIn) &&
                        resultNumber !== previousResult;
                      if (!metaChanged && !resultChanged) {
                        notifyError(
                          new Error("No hay cambios para guardar."),
                          "No hay cambios para guardar.",
                        );
                        return;
                      }
                      onSave({
                        keyResultId: kr.keyResultId,
                        meta: metaChanged ? metaNumber : undefined,
                        result: resultChanged ? resultNumber : undefined,
                      });
                    }}
                  >
                    Guardar meta y resultado
                  </Button>
                ) : null}
                {kr.metricType === "BOOLEAN" && goal.canCheckIn ? (
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
          );
        })}
      </ul>
      {historyKrId ? (
        <div className="rounded-lg border border-border p-3">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-medium">Historial de avances</h4>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setHistoryKrId(null)}
            >
              Cerrar
            </Button>
          </div>
          {historyLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <CheckInHistoryList items={historyItems} />
          )}
        </div>
      ) : null}
      {goal.canRequestCompletion ? (
        <Button size="sm" variant="secondary" onClick={onRequestClose}>
          Solicitar cierre
        </Button>
      ) : null}
      {goal.pendingCompletionRequest ? (
        <p className="text-sm text-muted-foreground">
          En revisión de cierre desde{" "}
          {new Date(goal.pendingCompletionRequest.requestedAt).toLocaleString(
            "es",
          )}
        </p>
      ) : null}
    </div>
  );
}

function krDraftsFromGoal(goal: {
  progress?: {
    keyResults: Array<{
      keyResultId: string;
      targetValue: string | null;
      currentNumericValue: string | null;
    }>;
  } | null;
}): Record<string, { meta: string; result: string }> {
  const next: Record<string, { meta: string; result: string }> = {};
  for (const kr of goal.progress?.keyResults ?? []) {
    next[kr.keyResultId] = {
      meta: kr.targetValue ?? "",
      result: kr.currentNumericValue ?? "",
    };
  }
  return next;
}

function parseTrackingNumber(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}
