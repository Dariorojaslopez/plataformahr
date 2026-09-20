"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { EntityEditorShell } from "@/components/organization/entity-editor-shell";
import { FormSelect } from "@/components/organization/form-select";
import { CycleFormFields } from "@/components/performance/cycle-form-fields";
import { CycleAnalyticsTab } from "@/components/performance/cycle-analytics-tab";
import { CycleParticipantsTab } from "@/components/performance/cycle-participants-tab";
import { CyclePopulationTab } from "@/components/performance/cycle-population-tab";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCompanyId } from "@/hooks/use-company-id";
import { getErrorMessage } from "@/lib/api/errors";
import { performanceApi, performanceKeys } from "@/lib/api/performance";
import {
  canActivateCycle,
  canCancelCycle,
  canCloseCycle,
  canEditCycleMetadata,
  canEditCycleStructure,
} from "@/lib/performance/activation";
import {
  buildUpdateCyclePayload,
  cycleEvaluatorWeightsAreValid,
  cycleFormFromPerformanceCycle,
  cycleGoalsCompositionIsValid,
  type CycleFormState,
} from "@/lib/performance/cycle-form";
import {
  CYCLE_STATUS_LABELS,
  cycleStatusVariant,
} from "@/lib/performance/cycle-labels";
import {
  evaluatorWeightsAreValid,
  formatEvaluatorWeightLabel,
} from "@/lib/performance/evaluator-weights";
import { formatResultCompositionWeightLabel } from "@/lib/performance/result-composition-weights";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import {
  autoQualitativeScaleId,
  qualitativeScalesForRating,
} from "@/lib/performance/scale-kind";
type CompetencyForm = {
  competencyId: string;
  scaleId: string;
  order: string;
};

const emptyCompetencyForm = (): CompetencyForm => ({
  competencyId: "",
  scaleId: "",
  order: "0",
});

export function CycleDetailPageClient() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const params = useParams<{ id: string }>();
  const cycleId = params.id;

  const [metaOpen, setMetaOpen] = useState(false);
  const [metaForm, setMetaForm] = useState<CycleFormState | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [compOpen, setCompOpen] = useState(false);
  const [compForm, setCompForm] = useState<CompetencyForm>(emptyCompetencyForm());
  const [compError, setCompError] = useState<string | null>(null);

  const cycleQuery = useQuery({
    queryKey: performanceKeys.cycle(companyId, cycleId),
    queryFn: () => performanceApi.getCycle(cycleId),
  });

  const competenciesQuery = useQuery({
    queryKey: performanceKeys.competencies(companyId, {
      status: "ACTIVE",
      limit: 100,
    }),
    queryFn: () =>
      performanceApi.listCompetencies({ status: "ACTIVE", limit: 100 }),
  });

  const scalesQuery = useQuery({
    queryKey: performanceKeys.scales(companyId, {
      status: "ACTIVE",
      kind: "QUALITATIVE",
      limit: 100,
    }),
    queryFn: () =>
      performanceApi.listScales({
        status: "ACTIVE",
        kind: "QUALITATIVE",
        limit: 100,
      }),
  });

  const cycle = cycleQuery.data;
  const assignments = useMemo(
    () => cycle?.competencies ?? [],
    [cycle?.competencies],
  );
  const structureEditable = cycle
    ? canEditCycleStructure(cycle.status)
    : false;
  const metadataEditable = cycle ? canEditCycleMetadata(cycle.status) : false;

  const activateOk = cycle
    ? canActivateCycle({
        status: cycle.status,
        competencyCount: assignments.length,
        includeCompetencies: cycle.includeCompetencies !== false,
        selfEvaluationWeight: cycle.selfEvaluationWeight,
        managerEvaluationWeight: cycle.managerEvaluationWeight,
        evaluationModel: cycle.evaluationModel,
        peerEvaluationWeight: cycle.peerEvaluationWeight,
        reportEvaluationWeight: cycle.reportEvaluationWeight,
        clientEvaluationWeight: cycle.clientEvaluationWeight,
      })
    : false;

  const assignedCompetencyIds = useMemo(
    () => new Set(assignments.map((a) => a.competencyId)),
    [assignments],
  );

  const availableCompetencies = useMemo(
    () =>
      (competenciesQuery.data?.items ?? []).filter(
        (c) => !assignedCompetencyIds.has(c.id),
      ),
    [competenciesQuery.data?.items, assignedCompetencyIds],
  );

  const qualitativeScales = useMemo(
    () => qualitativeScalesForRating(scalesQuery.data?.items ?? []),
    [scalesQuery.data?.items],
  );

  async function invalidateCycle() {
    await queryClient.invalidateQueries({
      queryKey: performanceKeys.cycle(companyId, cycleId),
    });
    await queryClient.invalidateQueries({
      queryKey: performanceKeys.cycles(companyId),
    });
  }

  const metaMutation = useMutation({
    mutationFn: async () => {
      if (!metaForm) throw new Error("Formulario incompleto.");
      if (!cycleEvaluatorWeightsAreValid(metaForm)) {
        throw new Error(
          "La ponderación de evaluadores debe sumar exactamente 100%.",
        );
      }
      if (!cycleGoalsCompositionIsValid(metaForm)) {
        throw new Error(
          "Revisa la composición: activa competencias o indica pesos de objetivos que no superen el rango.",
        );
      }
      return performanceApi.updateCycle(
        cycleId,
        buildUpdateCyclePayload(metaForm),
      );
    },
    onSuccess: async () => {
      await invalidateCycle();
      setMetaOpen(false);
      setMetaError(null);
      notifySuccess("Ciclo actualizado");
    },
    onError: (error) => {
      setMetaError(getErrorMessage(error, "No se pudo actualizar."));
      notifyError(error, "No se pudo actualizar.");
    },
  });

  const activateMutation = useMutation({
    mutationFn: () => performanceApi.activateCycle(cycleId),
    onSuccess: async () => {
      await invalidateCycle();
      notifySuccess("Ciclo activado");
    },
    onError: (error) => notifyError(error, "No se pudo activar el ciclo."),
  });

  const closeMutation = useMutation({
    mutationFn: () => performanceApi.closeCycle(cycleId),
    onSuccess: async () => {
      await invalidateCycle();
      notifySuccess("Ciclo cerrado");
    },
    onError: (error) => notifyError(error, "No se pudo cerrar el ciclo."),
  });

  const cancelMutation = useMutation({
    mutationFn: () => performanceApi.cancelCycle(cycleId),
    onSuccess: async () => {
      await invalidateCycle();
      notifySuccess("Ciclo cancelado");
    },
    onError: (error) => notifyError(error, "No se pudo cancelar el ciclo."),
  });

  const saveCompMutation = useMutation({
    mutationFn: async () => {
      if (!compForm.competencyId || !compForm.scaleId) {
        throw new Error(
          qualitativeScales.length === 0
            ? "Define una escala cualitativa activa para calificar competencias."
            : "Competencia y escala cualitativa son obligatorias.",
        );
      }
      const order = Number(compForm.order);
      if (!Number.isInteger(order) || order < 0) {
        throw new Error("El orden debe ser un entero >= 0.");
      }

      return performanceApi.addCycleCompetency(cycleId, {
        competencyId: compForm.competencyId,
        scaleId: compForm.scaleId,
        weight: null,
        order,
        required: true,
      });
    },
    onSuccess: async () => {
      await invalidateCycle();
      setCompOpen(false);
      setCompForm(emptyCompetencyForm());
      setCompError(null);
      notifySuccess("Competencia agregada");
    },
    onError: (error) => {
      setCompError(getErrorMessage(error, "No se pudo guardar."));
      notifyError(error, "No se pudo guardar.");
    },
  });

  function openMetaEdit() {
    if (!cycle) return;
    setMetaForm(cycleFormFromPerformanceCycle(cycle));
    setMetaError(null);
    setMetaOpen(true);
  }

  function openAddCompetency() {
    const nextOrder =
      assignments.length === 0
        ? 0
        : Math.max(...assignments.map((a) => a.order)) + 1;
    setCompForm({
      ...emptyCompetencyForm(),
      order: String(nextOrder),
      scaleId: autoQualitativeScaleId(qualitativeScales),
    });
    setCompError(null);
    setCompOpen(true);
  }

  if (cycleQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (cycleQuery.isError || !cycle) {
    return (
      <ErrorState
        title="No se pudo cargar el ciclo"
        description={getErrorMessage(cycleQuery.error, "Error al cargar.")}
        onRetry={() => void cycleQuery.refetch()}
      />
    );
  }

  const transitionPending =
    activateMutation.isPending ||
    closeMutation.isPending ||
    cancelMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
          <Link href="/performance/cycles">
            <ArrowLeft className="h-4 w-4" />
            Volver a ciclos
          </Link>
        </Button>
        <PageHeader
          title={cycle.name}
          description={cycle.description ?? "Detalle del ciclo de desempeño."}
          actions={
            <div className="flex flex-wrap gap-2">
              {metadataEditable ? (
                <Button type="button" variant="outline" onClick={openMetaEdit}>
                  <Pencil className="h-4 w-4" />
                  Editar datos
                </Button>
              ) : null}
              {cycle.status === "DRAFT" ? (
                <Button
                  type="button"
                  disabled={!activateOk || transitionPending}
                  onClick={() => activateMutation.mutate()}
                  title={
                    !activateOk
                      ? "Requiere competencias en el ciclo"
                      : undefined
                  }
                >
                  Activar
                </Button>
              ) : null}
              {canCloseCycle(cycle.status) ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={transitionPending}
                  onClick={() => closeMutation.mutate()}
                >
                  Cerrar
                </Button>
              ) : null}
              {canCancelCycle(cycle.status) ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={transitionPending}
                  onClick={() => cancelMutation.mutate()}
                >
                  Cancelar ciclo
                </Button>
              ) : null}
            </div>
          }
        />
      </div>

      <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-6">
        <div>
          <p className="text-xs text-muted-foreground">Estado</p>
          <Badge variant={cycleStatusVariant(cycle.status)} className="mt-1">
            {CYCLE_STATUS_LABELS[cycle.status]}
          </Badge>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Apertura / cierre</p>
          <p className="mt-1 text-sm font-medium">
            {cycle.startDate} → {cycle.endDate}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Fecha Autoevaluación</p>
          <p className="mt-1 text-sm font-medium">
            {cycle.evaluationStartDate && cycle.evaluationEndDate
              ? `${cycle.evaluationStartDate} → ${cycle.evaluationEndDate}`
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            Ponderación de evaluadores
          </p>
          <p className="mt-1 text-sm font-medium">
            {formatEvaluatorWeightLabel(
              cycle.selfEvaluationWeight,
              cycle.managerEvaluationWeight,
              {
                model: cycle.evaluationModel,
                peer: cycle.peerEvaluationWeight,
                report: cycle.reportEvaluationWeight,
                client: cycle.clientEvaluationWeight,
              },
            )}
          </p>
          {!evaluatorWeightsAreValid(
            cycle.selfEvaluationWeight,
            cycle.managerEvaluationWeight,
            {
              model: cycle.evaluationModel,
              peer: cycle.peerEvaluationWeight,
              report: cycle.reportEvaluationWeight,
              client: cycle.clientEvaluationWeight,
            },
          ) ? (
            <p className="mt-1 text-xs text-destructive">
              Los grupos habilitados deben sumar 100%.
            </p>
          ) : null}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Composición del resultado</p>
          <p className="mt-1 text-sm font-medium">
            {cycle.goalCycleId
              ? formatResultCompositionWeightLabel(
                  cycle.competencyResultWeight,
                  cycle.goalsResultWeight,
                  {
                    organizational: cycle.organizationalGoalsWeight,
                    individual: cycle.individualGoalsWeight,
                  },
                )
              : cycle.includeCompetencies === false
                ? "Sin competencias"
                : "Solo competencias"}
          </p>
        </div>
      </div>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Resumen</TabsTrigger>
          <TabsTrigger value="competencies">Competencias</TabsTrigger>
          <TabsTrigger value="participants">Participantes</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-4">
          <CycleAnalyticsTab cycleId={cycleId} />
        </TabsContent>

        <TabsContent value="competencies" className="mt-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Competencias del ciclo</h2>
              <p className="text-sm text-muted-foreground">
                {structureEditable
                  ? "Se cargan solas al asignar población, según el nivel del cargo. También puedes agregar alguna extra."
                  : "La estructura solo se edita en borrador."}
              </p>
            </div>
            {structureEditable ? (
              <Button type="button" onClick={openAddCompetency}>
                <Plus className="h-4 w-4" />
                Agregar competencia
              </Button>
            ) : null}
          </div>

          {assignments.length === 0 ? (
            <EmptyState
              title="Sin competencias"
              description="Asigna población en la pestaña Participantes para cargar las competencias del nivel de cada cargo, o agrégalas aquí."
              action={
                structureEditable ? (
                  <Button type="button" onClick={openAddCompetency}>
                    Agregar competencia
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Orden</TableHead>
                      <TableHead>Competencia</TableHead>
                      <TableHead>Escala</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.order}</TableCell>
                        <TableCell className="font-medium">
                          {row.competency?.name ?? row.competencyId}
                        </TableCell>
                        <TableCell>
                          {row.scale?.name ?? row.scaleId}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-3 md:hidden">
                {assignments.map((row) => (
                  <div
                    key={row.id}
                    className="space-y-2 rounded-lg border border-border bg-card p-4"
                  >
                    <p className="font-medium">
                      {row.competency?.name ?? row.competencyId}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Escala: {row.scale?.name ?? row.scaleId}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Orden {row.order}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="participants" className="mt-4 space-y-8">
          <CyclePopulationTab
            cycleId={cycleId}
            cycleStatus={cycle.status}
          />
          {cycle.status !== "DRAFT" ? (
            <CycleParticipantsTab
              cycleId={cycleId}
              cycleStatus={cycle.status}
              hideAssignment
            />
          ) : null}
        </TabsContent>
      </Tabs>

      <EntityEditorShell
        open={metaOpen}
        onOpenChange={setMetaOpen}
        title="Editar ciclo"
      >
        {metaForm ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              metaMutation.mutate();
            }}
          >
            <CycleFormFields
              form={metaForm}
              setForm={(updater) => {
                setMetaForm((prev) => {
                  if (!prev) return prev;
                  return typeof updater === "function"
                    ? updater(prev)
                    : updater;
                });
              }}
              idPrefix="meta"
            />
            {metaError ? (
              <p className="text-sm text-destructive" role="alert">
                {metaError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMetaOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={metaMutation.isPending}>
                {metaMutation.isPending ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </form>
        ) : null}
      </EntityEditorShell>

      <EntityEditorShell
        open={compOpen}
        onOpenChange={setCompOpen}
        title="Agregar competencia"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveCompMutation.mutate();
          }}
        >
          <FormSelect
            id="comp-select"
            label="Competencia"
            required
            value={compForm.competencyId}
            onChange={(competencyId) => {
              setCompForm((f) => ({
                ...f,
                competencyId,
                scaleId: f.scaleId || autoQualitativeScaleId(qualitativeScales),
              }));
            }}
            options={availableCompetencies.map((c) => ({
              value: c.id,
              label: c.code ? `${c.name} (${c.code})` : c.name,
            }))}
          />
          {qualitativeScales.length === 1 ? (
            <p className="text-sm text-muted-foreground">
              Se califica con la escala cualitativa{" "}
              <span className="font-medium text-foreground">
                {qualitativeScales[0]?.name}
              </span>
              .
            </p>
          ) : (
            <FormSelect
              id="scale-select"
              label="Escala cualitativa"
              required
              value={compForm.scaleId}
              onChange={(scaleId) => setCompForm((f) => ({ ...f, scaleId }))}
              options={qualitativeScales.map((s) => ({
                value: s.id,
                label: s.name,
              }))}
              hint="Las competencias no usan escalas cuantitativas."
            />
          )}
          {compError ? (
            <p className="text-sm text-destructive" role="alert">
              {compError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCompOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saveCompMutation.isPending}>
              {saveCompMutation.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      </EntityEditorShell>
    </div>
  );
}
