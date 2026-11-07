"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { performanceApi, performanceKeys } from "@/lib/api/performance";
import { organizationApi } from "@/lib/api/organization";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type { CycleParticipantListItem } from "@/types/performance";

const PHASES = [
  { value: "GOAL_DEFINITION", label: "Definición de objetivos" },
  { value: "FOLLOW_UP", label: "Seguimiento" },
  { value: "SELF_EVALUATION", label: "Autoevaluación" },
  { value: "EVALUATION", label: "Evaluación del líder" },
  { value: "CALIBRATION", label: "Calibración" },
  { value: "CLOSING", label: "Cierre" },
];

export function ParticipantFlowPanel({
  companyId,
  cycleId,
  items,
}: {
  companyId: string;
  cycleId: string;
  items: CycleParticipantListItem[];
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [phase, setPhase] = useState(PHASES[0].value);
  const [leaderSearch, setLeaderSearch] = useState("");
  const [leaderId, setLeaderId] = useState("");
  const [unlockFor, setUnlockFor] = useState<string | null>(null);
  const [goalIds, setGoalIds] = useState<string[]>([]);

  const goalsQuery = useQuery({
    queryKey: ["flow-goals", companyId, cycleId, unlockFor],
    queryFn: () => performanceApi.listParticipantGoals(cycleId, unlockFor ?? ""),
    enabled: Boolean(unlockFor),
  });

  const leadersQuery = useQuery({
    queryKey: ["flow-leaders", companyId, leaderSearch],
    queryFn: () =>
      organizationApi.listEmployees({
        search: leaderSearch,
        status: "ACTIVE",
        limit: 8,
      }),
    enabled: leaderSearch.trim().length >= 2,
  });

  const phaseMutation = useMutation({
    mutationFn: () =>
      performanceApi.resetParticipantPhase(cycleId, {
        participantIds: selected,
        phase,
      }),
    onSuccess: async () => {
      notifySuccess("Fase actualizada para los colaboradores seleccionados.");
      await queryClient.invalidateQueries({
        queryKey: performanceKeys.all(companyId),
      });
    },
    onError: (error) => notifyError(error, "No se pudo devolver la fase."),
  });

  const leaderMutation = useMutation({
    mutationFn: () =>
      performanceApi.reassignParticipantLeader(cycleId, {
        participantIds: selected,
        managerEmployeeId: leaderId,
      }),
    onSuccess: async () => {
      notifySuccess("El líder del grupo quedó actualizado.");
      setLeaderId("");
      await queryClient.invalidateQueries({
        queryKey: performanceKeys.all(companyId),
      });
    },
    onError: (error) => notifyError(error, "No se pudo cambiar el líder."),
  });

  const unlockMutation = useMutation({
    mutationFn: () =>
      performanceApi.unlockParticipantGoals(
        cycleId,
        unlockFor ?? "",
        goalIds,
      ),
    onSuccess: async () => {
      notifySuccess("Objetivos desbloqueados para ese colaborador.");
      setUnlockFor(null);
      setGoalIds([]);
    },
    onError: (error) => notifyError(error, "No se pudieron desbloquear los objetivos."),
  });

  if (items.length === 0) return null;

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div>
        <h3 className="text-sm font-semibold">Control del flujo</h3>
        <p className="text-xs text-muted-foreground">
          Selecciona colaboradores de esta página para devolverlos a una fase
          anterior o cambiar el líder de un grupo.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        {items.map((row) => (
          <label key={row.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(row.id)}
              onChange={(event) =>
                setSelected((current) =>
                  event.target.checked
                    ? [...current, row.id]
                    : current.filter((id) => id !== row.id),
                )
              }
            />
            {row.employee.firstName} {row.employee.lastName}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="flow-phase">Devolver a</Label>
          <select
            id="flow-phase"
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={phase}
            onChange={(event) => setPhase(event.target.value)}
          >
            {PHASES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={selected.length === 0 || phaseMutation.isPending}
          onClick={() => {
            if (
              window.confirm(
                "¿Devolver a los colaboradores seleccionados a esa fase?",
              )
            ) {
              phaseMutation.mutate();
            }
          }}
        >
          Confirmar devolución
        </Button>
      </div>
      <div className="space-y-2">
        <Label htmlFor="flow-leader-search">Nuevo líder del grupo</Label>
        <Input
          id="flow-leader-search"
          value={leaderSearch}
          placeholder="Busca por nombre"
          onChange={(event) => setLeaderSearch(event.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {(leadersQuery.data?.items ?? []).map((employee) => (
            <Button
              key={employee.id}
              type="button"
              size="sm"
              variant={leaderId === employee.id ? "default" : "outline"}
              onClick={() => setLeaderId(employee.id)}
            >
              {employee.firstName} {employee.lastName}
            </Button>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={
            selected.length < 2 || !leaderId || leaderMutation.isPending
          }
          onClick={() => leaderMutation.mutate()}
        >
          Cambiar líder del grupo
        </Button>
        <p className="text-xs text-muted-foreground">
          El cambio de líder aplica a dos o más colaboradores.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="flow-unlock">Desbloquear objetivos</Label>
        <select
          id="flow-unlock"
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={unlockFor ?? ""}
          onChange={(event) => setUnlockFor(event.target.value || null)}
        >
          <option value="">Colaborador</option>
          {items.map((row) => (
            <option key={row.id} value={row.id}>
              {row.employee.firstName} {row.employee.lastName}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-3">
          {(goalsQuery.data?.items ?? []).map((goal) => (
            <label key={goal.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={goalIds.includes(goal.id)}
                onChange={(event) =>
                  setGoalIds((current) =>
                    event.target.checked
                      ? [...current, goal.id]
                      : current.filter((id) => id !== goal.id),
                  )
                }
              />
              {goal.title}
            </label>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={!unlockFor || unlockMutation.isPending}
          onClick={() => unlockMutation.mutate()}
        >
          Desbloquear
        </Button>
      </div>
    </section>
  );
}
