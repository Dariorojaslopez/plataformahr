"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CheckInDialog } from "@/components/goals/check-in-dialog";
import { GoalProgressBar } from "@/components/goals/progress-bar";
import { EvaluationDetailPageClient } from "@/components/performance/evaluation-detail-page";
import { GoalDefinitionForm } from "@/components/performance/goal-definition-form";
import { GoalApprovalsPanel } from "@/components/performance/goal-approvals-panel";
import { ClosingSessionForm } from "@/components/performance/closing-session-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanyId } from "@/hooks/use-company-id";
import { getErrorMessage } from "@/lib/api/errors";
import { goalKeys, goalsApi } from "@/lib/api/goals";
import { performanceApi, performanceKeys } from "@/lib/api/performance";
import { formatCurrentValue } from "@/lib/goals/progress";
import {
  CYCLE_STATUS_LABELS,
  cycleStatusVariant,
} from "@/lib/performance/cycle-labels";
import {
  canEditGoalsInCyclePhase,
  type CyclePhase,
} from "@/lib/performance/cycle-phases";
import {
  evaluationsForPhase,
  groupMineEvaluationsByCycle,
  workspacePhases,
  type MineCycleGroup,
} from "@/lib/performance/mine-cycles";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type { Goal, GoalKeyResultProgress } from "@/types/goals";

export function MyCycleWorkspacePageClient() {
  const companyId = useCompanyId();
  const params = useParams<{ cycleId: string }>();
  const cycleId = params.cycleId;

  const mineQuery = useQuery({
    queryKey: performanceKeys.evaluationsMine(companyId),
    queryFn: () => performanceApi.listMineEvaluations(),
  });

  const groups = useMemo(
    () => groupMineEvaluationsByCycle(mineQuery.data),
    [mineQuery.data],
  );
  const group = groups.find((item) => item.cycleId === cycleId) ?? null;
  const phases = group ? workspacePhases(group) : [];
  const currentId = phases.find((phase) => phase.visibility === "current")?.id;

  useEffect(() => {
    if (!currentId) return;
    document
      .getElementById(`cycle-phase-${currentId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [currentId]);

  if (mineQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (mineQuery.isError) {
    return (
      <ErrorState
        title="No se pudo cargar el ciclo"
        description={getErrorMessage(mineQuery.error, "Error al cargar.")}
        onRetry={() => void mineQuery.refetch()}
      />
    );
  }

  if (!group) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
          <Link href="/performance/my-evaluations">
            <ArrowLeft className="h-4 w-4" />
            Volver a mis evaluaciones
          </Link>
        </Button>
        <EmptyState
          title="Ciclo no encontrado"
          description="No tienes evaluaciones invitadas en este ciclo, o el enlace ya no es válido."
        />
      </div>
    );
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
          title={group.name}
          description={
            group.editable
              ? "Editas solo la fase actual. Las anteriores se muestran en solo lectura y las futuras no aparecen."
              : "Ciclo inactivo: solo visualización de las fases ya ocurridas."
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <Badge variant={cycleStatusVariant(group.status)}>
          {CYCLE_STATUS_LABELS[group.status]}
        </Badge>
        <p className="text-sm text-muted-foreground">
          {group.startDate} → {group.endDate}
        </p>
        {group.currentPhase ? (
          <p className="text-sm">
            Fase actual:{" "}
            <span className="font-medium">{group.currentPhase.label}</span>
          </p>
        ) : null}
      </div>

      {phases.length === 0 ? (
        <EmptyState
          title="Aún no hay una fase visible"
          description="El formulario se habilita cuando comienza la ventana de la fase actual. Las fases futuras no se muestran."
        />
      ) : (
        <div className="space-y-4">
          {phases.map((phase) => (
            <PhaseSection key={phase.id} group={group} phase={phase} />
          ))}
        </div>
      )}
    </div>
  );
}

function PhaseSection({
  group,
  phase,
}: {
  group: MineCycleGroup;
  phase: CyclePhase;
}) {
  const isCurrent = phase.visibility === "current";
  const phaseEditable = isCurrent && group.editable;
  const evals = evaluationsForPhase(group, phase.kind);
  const [expanded, setExpanded] = useState(isCurrent);

  return (
    <details
      id={`cycle-phase-${phase.id}`}
      className="rounded-lg border border-border bg-card open:shadow-sm"
      open={expanded}
      onToggle={(event) => {
        setExpanded(event.currentTarget.open);
      }}
    >
      <summary className="cursor-pointer list-none px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium">{phase.label}</p>
            <p className="text-xs text-muted-foreground">
              {phase.startDate} → {phase.endDate}
            </p>
          </div>
          <Badge variant={isCurrent ? "default" : "outline"}>
            {isCurrent
              ? phaseEditable
                ? "Fase actual"
                : "Fase actual · solo lectura"
              : "Solo lectura"}
          </Badge>
        </div>
      </summary>

      <div className="space-y-4 border-t border-border px-4 py-4">
        {phase.kind === "CALIBRATION" ? (
          <p className="text-sm text-muted-foreground">
            Mueve colaboradores en el 9Box de la sesión de calibración. Al
            guardar cada cambio se pide una justificación.
          </p>
        ) : null}

        {phase.kind === "GOAL_DEFINITION" ? (
          <>
            <GoalDefinitionForm
              cycleId={group.cycleId}
              forceReadOnly={!phaseEditable}
            />
            <GoalApprovalsPanel
              cycleId={group.cycleId}
              forceReadOnly={!phaseEditable}
            />
          </>
        ) : null}

        {phase.kind === "FOLLOW_UP" ? (
          <>
            <GoalDefinitionForm
              cycleId={group.cycleId}
              followUpMode
              forceReadOnly={!phaseEditable}
            />
            <GoalApprovalsPanel
              cycleId={group.cycleId}
              forceReadOnly={!phaseEditable}
            />
            <CycleGoalsPanel
              group={group}
              phase={phase}
              allowCheckIn={canEditGoalsInCyclePhase({
                cycleStatus: group.status,
                phases: group.phases,
                kind: "FOLLOW_UP",
              })}
            />
          </>
        ) : null}

        {phase.kind === "CLOSING" ? (
          <ClosingSessionForm
            cycleId={group.cycleId}
            forceReadOnly={!phaseEditable}
          />
        ) : null}

        {evals.self.map((item) => (
          <EvaluationDetailPageClient
            key={item.id}
            evaluationId={item.id}
            embedded
            forceReadOnly={!phaseEditable}
          />
        ))}
        {evals.others.map((item) => (
          <EvaluationDetailPageClient
            key={item.id}
            evaluationId={item.id}
            embedded
            forceReadOnly={!phaseEditable}
          />
        ))}

        {phase.kind !== "CALIBRATION" &&
        phase.kind !== "GOAL_DEFINITION" &&
        phase.kind !== "FOLLOW_UP" &&
        phase.kind !== "CLOSING" &&
        evals.self.length === 0 &&
        evals.others.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tienes evaluaciones asignadas en esta fase.
          </p>
        ) : null}
      </div>
    </details>
  );
}

function CycleGoalsPanel({
  group,
  phase,
  allowCheckIn,
}: {
  group: MineCycleGroup;
  phase: CyclePhase;
  allowCheckIn: boolean;
}) {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const [activeKr, setActiveKr] = useState<{
    goal: Goal;
    kr: GoalKeyResultProgress;
  } | null>(null);

  const mineQuery = useQuery({
    queryKey: goalKeys.mine(companyId),
    queryFn: () => goalsApi.listMine(),
    enabled: Boolean(group.goalCycleId),
  });

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
      await queryClient.invalidateQueries({ queryKey: goalKeys.all(companyId) });
    },
    onError: (err) => notifyError(err, "No se pudo registrar el avance"),
  });

  if (!group.goalCycleId) {
    return (
      <p className="text-sm text-muted-foreground">
        Este ciclo no tiene un periodo de objetivos vinculado.
      </p>
    );
  }

  if (mineQuery.isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (mineQuery.isError) {
    return (
      <ErrorState
        title="No se pudieron cargar los objetivos"
        description={getErrorMessage(mineQuery.error, "Error al cargar.")}
        onRetry={() => void mineQuery.refetch()}
      />
    );
  }

  const goals = (mineQuery.data?.items ?? []).filter(
    (goal) => goal.cycleId === group.goalCycleId,
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {phase.kind === "GOAL_DEFINITION"
          ? "Consulta los objetivos vinculados a este ciclo. La definición se realiza en Mis objetivos."
          : allowCheckIn
            ? "Registra el avance de tus objetivos en este seguimiento."
            : "Consulta el avance de tus objetivos. Esta fase no admite edición."}
      </p>

      {goals.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay objetivos asignados para este periodo.
        </p>
      ) : (
        <ul className="space-y-3">
          {goals.map((goal) => (
            <li
              key={goal.id}
              className="space-y-2 rounded-lg border border-border bg-background p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <Link
                  href={`/goals/${goal.id}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {goal.title}
                </Link>
              </div>
              {goal.progress ? (
                <GoalProgressBar value={goal.progress.progressPercentage} />
              ) : null}
              <ul className="space-y-2">
                {(goal.progress?.keyResults ?? []).map((kr) => (
                  <li
                    key={kr.keyResultId}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span>
                      {kr.title}
                      <span className="ml-2 text-muted-foreground">
                        {formatCurrentValue({
                          metricType: kr.metricType,
                          currentNumericValue: kr.currentNumericValue,
                          currentBooleanValue: kr.currentBooleanValue,
                          currencyCode: kr.currencyCode,
                          unit: kr.unit,
                        })}
                      </span>
                    </span>
                    {allowCheckIn && goal.canCheckIn ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setActiveKr({ goal, kr })}
                      >
                        Registrar avance
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

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
    </div>
  );
}
