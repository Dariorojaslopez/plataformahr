"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FormSelect } from "@/components/organization/form-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCompanyId } from "@/hooks/use-company-id";
import { getErrorMessage } from "@/lib/api/errors";
import { performanceApi, performanceKeys } from "@/lib/api/performance";
import {
  GOAL_PROGRESS_STATUS_LABELS,
  PDI_STATUS_LABELS,
  SCALE_KIND_LABELS,
  clampProgressPercent,
  pdiStatusFromPercent,
} from "@/lib/performance/goal-progress";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type {
  GoalDefinitionGoal,
  GoalDefinitionWorkspace,
  GoalProgressStatus,
  SaveGoalDefinitionInput,
} from "@/types/performance";

type DraftGoal = {
  key: string;
  id?: string;
  title: string;
  description: string;
  scaleId: string;
  progressStatus: GoalProgressStatus;
  parentGoalId?: string;
  assigneeEmployeeId?: string;
};

type DraftPdi = {
  name: string;
  competencyId: string;
  actions70: string;
  actions20: string;
  actions10: string;
  observations: string;
  progressNotes: string;
  strengths: string;
  improvements: string;
  progressPercent: number;
};

function emptyGoal(): DraftGoal {
  return {
    key: crypto.randomUUID(),
    title: "",
    description: "",
    scaleId: "",
    progressStatus: "NOT_STARTED",
  };
}

function fromApiGoal(
  goal: GoalDefinitionGoal,
  extra?: Partial<DraftGoal>,
): DraftGoal {
  return {
    key: goal.id,
    id: goal.id,
    title: goal.title,
    description: goal.description ?? "",
    scaleId: goal.scaleId ?? "",
    progressStatus: goal.progressStatus,
    ...extra,
  };
}

function emptyPdi(): DraftPdi {
  return {
    name: "",
    competencyId: "",
    actions70: "",
    actions20: "",
    actions10: "",
    observations: "",
    progressNotes: "",
    strengths: "",
    improvements: "",
    progressPercent: 0,
  };
}

export function GoalDefinitionForm({
  cycleId,
  followUpMode = false,
  forceReadOnly = false,
}: {
  cycleId: string;
  followUpMode?: boolean;
  forceReadOnly?: boolean;
}) {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const [individual, setIndividual] = useState<DraftGoal[]>([]);
  const [cascaded, setCascaded] = useState<DraftGoal[]>([]);
  const [pdi, setPdi] = useState<DraftPdi>(emptyPdi());
  const [hydrated, setHydrated] = useState(false);

  const query = useQuery({
    queryKey: performanceKeys.goalDefinition(companyId, cycleId),
    queryFn: () => performanceApi.getGoalDefinition(cycleId),
  });

  useEffect(() => {
    if (!query.data) return;
    setIndividual(query.data.individualGoals.map((goal) => fromApiGoal(goal)));
    setCascaded(
      query.data.cascadedGoals.map((goal) =>
        fromApiGoal(goal, {
          parentGoalId: goal.parentGoalId ?? "",
          assigneeEmployeeId: goal.assignee?.id ?? "",
        }),
      ),
    );
    setPdi(
      query.data.pdi
        ? {
            name: query.data.pdi.name,
            competencyId: query.data.pdi.competencyId ?? "",
            actions70: query.data.pdi.actions70 ?? "",
            actions20: query.data.pdi.actions20 ?? "",
            actions10: query.data.pdi.actions10 ?? "",
            observations: query.data.pdi.observations ?? "",
            progressNotes: query.data.pdi.progressNotes ?? "",
            strengths: query.data.pdi.strengths ?? "",
            improvements: query.data.pdi.improvements ?? "",
            progressPercent: query.data.pdi.progressPercent,
          }
        : emptyPdi(),
    );
    setHydrated(true);
  }, [query.data]);

  const data = query.data;
  const structureEditable =
    Boolean(data?.editable) && !forceReadOnly;
  const progressEditable =
    Boolean(data?.progressEditable || data?.editable) && !forceReadOnly;
  const canAddFinished =
    Boolean(followUpMode && data?.canAddFinishedGoal) && !forceReadOnly;
  const readOnly = !structureEditable && !progressEditable;
  const [editComment, setEditComment] = useState("");

  const payload = useMemo(
    () => (data ? buildPayload(individual, cascaded, pdi) : null),
    [data, individual, cascaded, pdi],
  );

  const saveMutation = useMutation({
    mutationFn: () =>
      performanceApi.saveGoalDefinition(cycleId, payload!),
    onSuccess: async () => {
      notifySuccess("Definición guardada");
      await queryClient.invalidateQueries({
        queryKey: performanceKeys.goalDefinition(companyId, cycleId),
      });
    },
    onError: (error) => notifyError(error, "No se pudo guardar la definición."),
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      performanceApi.submitGoalDefinition(cycleId, payload!),
    onSuccess: async () => {
      notifySuccess("Definición enviada a aprobación");
      await queryClient.invalidateQueries({
        queryKey: performanceKeys.goalDefinition(companyId, cycleId),
      });
    },
    onError: (error) =>
      notifyError(error, "No se pudo enviar la definición a aprobación."),
  });

  const requestEditMutation = useMutation({
    mutationFn: () => performanceApi.requestGoalEdit(cycleId, editComment),
    onSuccess: async () => {
      notifySuccess("Solicitud enviada a tu líder");
      setEditComment("");
      await queryClient.invalidateQueries({
        queryKey: performanceKeys.goalDefinition(companyId, cycleId),
      });
    },
    onError: (error) =>
      notifyError(error, "No se pudo solicitar la edición."),
  });

  if (query.isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }
  if (query.isError || !data) {
    return (
      <ErrorState
        title="No se pudo cargar la definición de objetivos"
        description={getErrorMessage(query.error, "Error al cargar.")}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (!data.cycle.goalCycleId) {
    return (
      <p className="text-sm text-muted-foreground">
        Este ciclo no tiene un periodo de objetivos vinculado.
      </p>
    );
  }

  const scaleOptions = data.scales.map((scale) => ({
    value: scale.id,
    label: `${scale.name} (${SCALE_KIND_LABELS[scale.kind]})`,
  }));
  const orgOptions = data.organizationalGoals.map((goal) => ({
    value: goal.id,
    label: goal.title,
  }));
  const reportOptions = data.directReports.map((row) => ({
    value: row.id,
    label: `${row.firstName} ${row.lastName}`.trim(),
  }));
  const statusOptions = (
    Object.keys(GOAL_PROGRESS_STATUS_LABELS) as GoalProgressStatus[]
  ).map((value) => ({
    value,
    label: GOAL_PROGRESS_STATUS_LABELS[value],
  }));

  function validate(): string | null {
    if (individual.some((row) => !row.title.trim() || !row.scaleId)) {
      return "Cada objetivo individual necesita título y escala.";
    }
    if (
      cascaded.some(
        (row) =>
          !row.title.trim() ||
          !row.scaleId ||
          !row.parentGoalId ||
          !row.assigneeEmployeeId,
      )
    ) {
      return "Cada objetivo en cascadeo necesita título, escala, objetivo origen y colaborador.";
    }
    if (
      data?.cycle.maxObjectives != null &&
      individual.length > data.cycle.maxObjectives
    ) {
      return `El máximo de objetivos individuales es ${data.cycle.maxObjectives}.`;
    }
    return null;
  }

  function handleSave() {
    const message = validate();
    if (message) {
      notifyError(new Error(message), message);
      return;
    }
    saveMutation.mutate();
  }

  function handleSubmit() {
    const message = validate();
    if (message) {
      notifyError(new Error(message), message);
      return;
    }
    submitMutation.mutate();
  }

  return (
    <div className="space-y-6">
      {data.submittedAt ? (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
          {data.reviewStatus === "APPROVED"
            ? "Tu líder aprobó los objetivos. Quedaron bloqueados."
            : data.reviewStatus === "REJECTED"
              ? `Tu líder rechazó la definición${data.reviewComment ? `: ${data.reviewComment}` : "."}`
              : "Definición enviada a aprobación. Los objetivos quedaron bloqueados."}
          {progressEditable
            ? " Puedes actualizar el estado de avance en el seguimiento."
            : null}
        </p>
      ) : structureEditable ? (
        <p className="text-sm text-muted-foreground">
          Define tus objetivos individuales. Guarda el avance o envía a
          aprobación para bloquear la edición.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Esta fase es de solo lectura.
        </p>
      )}

      {data.organizationalGoals.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Objetivos organizacionales</h3>
          <p className="text-xs text-muted-foreground">
            Solo consulta. No se editan en esta fase.
          </p>
          <ul className="space-y-2">
            {data.organizationalGoals.map((goal) => (
              <li
                key={goal.id}
                className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm"
              >
                <p className="font-medium">{goal.title}</p>
                {goal.description ? (
                  <p className="text-muted-foreground">{goal.description}</p>
                ) : null}
                {goal.areaName ? (
                  <p className="text-xs text-muted-foreground">{goal.areaName}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.assignedFromCascade.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Objetivos asignados</h3>
          <p className="text-xs text-muted-foreground">
            Acciones que tu líder cascadeó hacia ti.
          </p>
          <ul className="space-y-2">
            {data.assignedFromCascade.map((goal) => (
              <li
                key={goal.id}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                <p className="font-medium">{goal.title}</p>
                {goal.parentGoalTitle ? (
                  <p className="text-xs text-muted-foreground">
                    Origen: {goal.parentGoalTitle}
                  </p>
                ) : null}
                <Badge variant="outline" className="mt-1">
                  {GOAL_PROGRESS_STATUS_LABELS[goal.progressStatus]}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <GoalDraftList
        title="Objetivos individuales"
        description="Crea los objetivos propios de este ciclo."
        rows={hydrated ? individual : []}
        onChange={setIndividual}
        structureEditable={structureEditable}
        progressEditable={progressEditable}
        allowAdd={structureEditable || canAddFinished}
        scaleOptions={scaleOptions}
        statusOptions={statusOptions}
        onAdd={() => setIndividual((rows) => [...rows, emptyGoal()])}
        addLabel="Agregar objetivo individual"
      />

      {data.cascadeEnabled ? (
        <GoalDraftList
          title="Cascadeo a colaboradores"
          description="Asigna una acción de un objetivo organizacional a un reporte directo. Para esa persona aparecerá como objetivo asignado."
          rows={hydrated ? cascaded : []}
          onChange={setCascaded}
          structureEditable={structureEditable}
          progressEditable={progressEditable}
          scaleOptions={scaleOptions}
          statusOptions={statusOptions}
          orgOptions={orgOptions}
          reportOptions={reportOptions}
          onAdd={() =>
            setCascaded((rows) => [
              ...rows,
              {
                ...emptyGoal(),
                parentGoalId: orgOptions[0]?.value ?? "",
                assigneeEmployeeId: "",
              },
            ])
          }
          addLabel="Agregar acción cascadeada"
          cascade
        />
      ) : null}

      <PdiFields
        pdi={pdi}
        onChange={setPdi}
        competencies={data.competencies}
        structureEditable={structureEditable}
        progressEditable={progressEditable}
        followUpMode={followUpMode}
      />

      {readOnly ? null : (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleSave}
            disabled={saveMutation.isPending || submitMutation.isPending}
          >
            Guardar
          </Button>
          {structureEditable ? (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={saveMutation.isPending || submitMutation.isPending}
            >
              Enviar a aprobación
            </Button>
          ) : null}
        </div>
      )}

      {followUpMode && data.canRequestEdit ? (
        <div className="space-y-2 rounded-lg border border-border p-4">
          <Label htmlFor="edit-request">Solicitar edición al líder</Label>
          <Textarea
            id="edit-request"
            value={editComment}
            rows={3}
            onChange={(event) => setEditComment(event.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => requestEditMutation.mutate()}
            disabled={requestEditMutation.isPending}
          >
            Solicitar modificación
          </Button>
        </div>
      ) : null}
      {data.pendingEditRequest ? (
        <p className="text-sm text-muted-foreground">
          Solicitud de edición pendiente de tu líder.
        </p>
      ) : null}
    </div>
  );
}

function GoalDraftList({
  title,
  description,
  rows,
  onChange,
  structureEditable,
  progressEditable,
  scaleOptions,
  statusOptions,
  orgOptions,
  reportOptions,
  onAdd,
  addLabel,
  cascade = false,
  allowAdd,
}: {
  title: string;
  description: string;
  rows: DraftGoal[];
  onChange: (rows: DraftGoal[]) => void;
  structureEditable: boolean;
  progressEditable: boolean;
  allowAdd?: boolean;
  scaleOptions: Array<{ value: string; label: string }>;
  statusOptions: Array<{ value: string; label: string }>;
  orgOptions?: Array<{ value: string; label: string }>;
  reportOptions?: Array<{ value: string; label: string }>;
  onAdd: () => void;
  addLabel: string;
  cascade?: boolean;
}) {
  function patch(key: string, next: Partial<DraftGoal>) {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...next } : row)));
  }
  const canAdd = allowAdd ?? structureEditable;

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay objetivos.</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((row, index) => {
            const rowStructure = structureEditable || !row.id;
            return (
            <li
              key={row.key}
              className="space-y-3 rounded-lg border border-border p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Objetivo {index + 1}</p>
                {rowStructure ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      onChange(rows.filter((item) => item.key !== row.key))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                    Quitar
                  </Button>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor={`goal-title-${row.key}`}>Título</Label>
                <Input
                  id={`goal-title-${row.key}`}
                  value={row.title}
                  disabled={!rowStructure}
                  onChange={(event) =>
                    patch(row.key, { title: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`goal-desc-${row.key}`}>Descripción</Label>
                <Textarea
                  id={`goal-desc-${row.key}`}
                  value={row.description}
                  disabled={!rowStructure}
                  rows={2}
                  onChange={(event) =>
                    patch(row.key, { description: event.target.value })
                  }
                />
              </div>
              {cascade ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormSelect
                    id={`goal-parent-${row.key}`}
                    label="Objetivo organizacional"
                    value={row.parentGoalId ?? ""}
                    onChange={(value) => patch(row.key, { parentGoalId: value })}
                    options={orgOptions ?? []}
                    disabled={!rowStructure}
                    required
                  />
                  <FormSelect
                    id={`goal-assignee-${row.key}`}
                    label="Colaborador (reporte directo)"
                    value={row.assigneeEmployeeId ?? ""}
                    onChange={(value) =>
                      patch(row.key, { assigneeEmployeeId: value })
                    }
                    options={reportOptions ?? []}
                    disabled={!rowStructure}
                    required
                    placeholder="Seleccionar colaborador"
                  />
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <FormSelect
                  id={`goal-scale-${row.key}`}
                  label="Escala de evaluación"
                  value={row.scaleId}
                  onChange={(value) => patch(row.key, { scaleId: value })}
                  options={scaleOptions}
                  disabled={!rowStructure}
                  required
                />
                <FormSelect
                  id={`goal-status-${row.key}`}
                  label="Estado"
                  value={row.progressStatus}
                  onChange={(value) =>
                    patch(row.key, {
                      progressStatus: value as GoalProgressStatus,
                    })
                  }
                  options={statusOptions}
                  disabled={!progressEditable}
                />
              </div>
            </li>
            );
          })}
        </ul>
      )}
      {canAdd ? (
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus className="h-4 w-4" />
          {addLabel}
        </Button>
      ) : null}
    </section>
  );
}

function PdiFields({
  pdi,
  onChange,
  competencies,
  structureEditable,
  progressEditable,
  followUpMode = false,
}: {
  pdi: DraftPdi;
  onChange: (next: DraftPdi) => void;
  competencies: GoalDefinitionWorkspace["competencies"];
  structureEditable: boolean;
  progressEditable: boolean;
  followUpMode?: boolean;
}) {
  const status = pdiStatusFromPercent(pdi.progressPercent);
  const percent = clampProgressPercent(pdi.progressPercent);

  return (
    <section className="space-y-4 rounded-lg border border-border p-4">
      <div>
        <h3 className="text-sm font-semibold">
          Plan de desarrollo individual (PDI)
        </h3>
        <p className="text-xs text-muted-foreground">
          Acciones 70-20-10 y avance del plan. El slider define el estado.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="pdi-name">Nombre del plan de desarrollo individual</Label>
        <Input
          id="pdi-name"
          value={pdi.name}
          disabled={!structureEditable}
          onChange={(event) => onChange({ ...pdi, name: event.target.value })}
        />
      </div>
      <FormSelect
        id="pdi-competency"
        label="Competencia a desarrollar"
        value={pdi.competencyId}
        onChange={(value) => onChange({ ...pdi, competencyId: value })}
        options={competencies.map((item) => ({
          value: item.id,
          label: item.name,
        }))}
        allowEmpty
        emptyLabel="Ninguna"
        disabled={!structureEditable}
      />
      <div className="space-y-2">
        <Label htmlFor="pdi-70">Acciones del 70 (experiencia)</Label>
        <Textarea
          id="pdi-70"
          value={pdi.actions70}
          disabled={!structureEditable}
          rows={3}
          onChange={(event) =>
            onChange({ ...pdi, actions70: event.target.value })
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pdi-20">Acciones del 20 (exposición)</Label>
        <Textarea
          id="pdi-20"
          value={pdi.actions20}
          disabled={!structureEditable}
          rows={3}
          onChange={(event) =>
            onChange({ ...pdi, actions20: event.target.value })
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pdi-10">Acciones del 10 (formación)</Label>
        <Textarea
          id="pdi-10"
          value={pdi.actions10}
          disabled={!structureEditable}
          rows={3}
          onChange={(event) =>
            onChange({ ...pdi, actions10: event.target.value })
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pdi-obs">Observaciones generales</Label>
        <Textarea
          id="pdi-obs"
          value={pdi.observations}
          disabled={!structureEditable}
          rows={3}
          onChange={(event) =>
            onChange({ ...pdi, observations: event.target.value })
          }
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="pdi-progress">Avance del plan</Label>
          <Badge variant="outline">{PDI_STATUS_LABELS[status]}</Badge>
        </div>
        <input
          id="pdi-progress"
          type="range"
          min={0}
          max={100}
          value={percent}
          disabled={!progressEditable}
          onChange={(event) =>
            onChange({
              ...pdi,
              progressPercent: Number(event.target.value),
            })
          }
          className="h-2 w-full cursor-pointer appearance-none rounded-full"
          style={{
            background: `linear-gradient(to right, #dc2626 0%, #eab308 50%, #16a34a 100%)`,
          }}
        />
        <p className="text-xs text-muted-foreground tabular-nums">
          {percent}% · Inicio: No iniciado · Con avance: En proceso · Final:
          Completado
        </p>
      </div>
      {followUpMode ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="pdi-notes">Avances</Label>
            <Textarea
              id="pdi-notes"
              value={pdi.progressNotes}
              disabled={!progressEditable}
              rows={3}
              onChange={(event) =>
                onChange({ ...pdi, progressNotes: event.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pdi-strengths">Fortalezas</Label>
            <Textarea
              id="pdi-strengths"
              value={pdi.strengths}
              disabled={!progressEditable}
              rows={3}
              onChange={(event) =>
                onChange({ ...pdi, strengths: event.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pdi-improvements">Oportunidades de mejora</Label>
            <Textarea
              id="pdi-improvements"
              value={pdi.improvements}
              disabled={!progressEditable}
              rows={3}
              onChange={(event) =>
                onChange({ ...pdi, improvements: event.target.value })
              }
            />
          </div>
        </>
      ) : null}
    </section>
  );
}

function buildPayload(
  individual: DraftGoal[],
  cascaded: DraftGoal[],
  pdi: DraftPdi,
): SaveGoalDefinitionInput {
  const body: SaveGoalDefinitionInput = {
    individualGoals: individual.map((row) => ({
      ...(row.id ? { id: row.id } : {}),
      title: row.title.trim(),
      description: row.description.trim() || null,
      scaleId: row.scaleId,
      progressStatus: row.progressStatus,
    })),
    cascadedGoals: cascaded.map((row) => ({
      ...(row.id ? { id: row.id } : {}),
      title: row.title.trim(),
      description: row.description.trim() || null,
      scaleId: row.scaleId,
      progressStatus: row.progressStatus,
      parentGoalId: row.parentGoalId ?? "",
      assigneeEmployeeId: row.assigneeEmployeeId ?? "",
    })),
  };
  if (pdi.name.trim()) {
    body.pdi = {
      name: pdi.name.trim(),
      competencyId: pdi.competencyId || null,
      actions70: pdi.actions70.trim() || null,
      actions20: pdi.actions20.trim() || null,
      actions10: pdi.actions10.trim() || null,
      observations: pdi.observations.trim() || null,
      progressNotes: pdi.progressNotes.trim() || null,
      strengths: pdi.strengths.trim() || null,
      improvements: pdi.improvements.trim() || null,
      progressPercent: clampProgressPercent(pdi.progressPercent),
    };
  }
  return body;
}
