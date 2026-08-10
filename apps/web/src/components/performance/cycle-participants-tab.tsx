"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, Eye, Plus, Search, Send, UserMinus, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EntityEditorShell } from "@/components/organization/entity-editor-shell";
import { PaginationControls } from "@/components/organization/pagination-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { organizationApi, orgKeys } from "@/lib/api/organization";
import { performanceApi, performanceKeys } from "@/lib/api/performance";
import { buildBulkAssignPayload } from "@/lib/performance/bulk-assign";
import {
  EVALUATION_STATUS_LABELS,
} from "@/lib/performance/evaluation-labels";
import {
  PARTICIPANT_STATUS_LABELS,
  participantStatusVariant,
} from "@/lib/performance/participant-labels";
import { formatScorePercentage } from "@/lib/performance/response-workspace";
import {
  RELEASE_RESULT_CONFIRMATION,
  RESULT_STATUS_LABELS,
  canCalculateParticipantResult,
  canMutateParticipantResults,
  canReleaseParticipantResult,
  resultStatusVariant,
} from "@/lib/performance/result-labels";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/ui/notify";
import type {
  CycleParticipantListItem,
  ListParticipantsParams,
  PerformanceCycleStatus,
  PerformanceEvaluationStatus,
} from "@/types/performance";

function employeeName(row: {
  firstName: string;
  lastName: string;
}): string {
  return `${row.firstName} ${row.lastName}`.trim();
}

function evalStatusLabel(
  status: PerformanceEvaluationStatus | undefined,
  scorePercentage?: string | null,
): string {
  if (!status) return "—";
  const base = EVALUATION_STATUS_LABELS[status];
  if (status === "SUBMITTED" && scorePercentage) {
    return `${base} (${formatScorePercentage(scorePercentage)})`;
  }
  return base;
}

type Props = {
  cycleId: string;
  cycleStatus: PerformanceCycleStatus;
};

export function CycleParticipantsTab({ cycleId, cycleStatus }: Props) {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const canAssign = cycleStatus === "ACTIVE";
  const canMutateResults = canMutateParticipantResults(cycleStatus);

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeePage, setEmployeePage] = useState(1);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [bulkSelected, setBulkSelected] = useState<
    Map<string, { id: string; label: string }>
  >(new Map());
  const [assignError, setAssignError] = useState<string | null>(null);
  const [releaseTarget, setReleaseTarget] =
    useState<CycleParticipantListItem | null>(null);

  const listParams: ListParticipantsParams = {
    search: search || undefined,
    page,
    limit: 20,
  };

  const participantsQuery = useQuery({
    queryKey: performanceKeys.participants(companyId, cycleId, listParams),
    queryFn: () => performanceApi.listParticipants(cycleId, listParams),
  });

  const assignedIdsQuery = useQuery({
    queryKey: performanceKeys.assignedEmployeeIds(companyId, cycleId),
    queryFn: () => performanceApi.listAllParticipantEmployeeIds(cycleId),
    enabled: addOpen || bulkOpen,
  });

  const assignedEmployeeIds = useMemo(() => {
    return new Set(assignedIdsQuery.data ?? []);
  }, [assignedIdsQuery.data]);

  const employeesQuery = useQuery({
    queryKey: orgKeys.employees(companyId, {
      status: "ACTIVE",
      search: employeeSearch || undefined,
      page: employeePage,
      limit: 20,
    }),
    queryFn: () =>
      organizationApi.listEmployees({
        status: "ACTIVE",
        search: employeeSearch || undefined,
        page: employeePage,
        limit: 20,
      }),
    enabled: addOpen || bulkOpen,
  });

  async function invalidateParticipants() {
    await queryClient.invalidateQueries({
      queryKey: [...performanceKeys.all(companyId), "participants", cycleId],
    });
  }

  async function invalidateAnalytics() {
    await queryClient.invalidateQueries({
      queryKey: performanceKeys.analytics(companyId, cycleId),
    });
  }

  async function invalidateParticipantsAndResults() {
    await Promise.all([
      invalidateParticipants(),
      invalidateAnalytics(),
      queryClient.invalidateQueries({
        queryKey: [...performanceKeys.all(companyId), "results"],
      }),
      queryClient.invalidateQueries({
        queryKey: performanceKeys.resultsMine(companyId),
      }),
    ]);
  }

  const assignMutation = useMutation({
    mutationFn: (employeeId: string) =>
      performanceApi.assignParticipant(cycleId, { employeeId }),
    onSuccess: async (result) => {
      await invalidateParticipants();
      await invalidateAnalytics();
      setAddOpen(false);
      setSelectedEmployeeId("");
      setAssignError(null);
      if (result.reason === "NO_DIRECT_MANAGER") {
        notifyInfo(
          "Participante asignado. No se creó evaluación de líder (sin manager directo).",
        );
      } else if (result.managerEvaluationCreated) {
        notifySuccess("Participante asignado con autoevaluación y evaluación de líder");
      } else {
        notifySuccess("Participante asignado");
      }
    },
    onError: (error) => {
      setAssignError(getErrorMessage(error, "No se pudo asignar."));
      notifyError(error, "No se pudo asignar.");
    },
  });

  const bulkMutation = useMutation({
    mutationFn: () =>
      performanceApi.bulkAssignParticipants(
        cycleId,
        buildBulkAssignPayload([...bulkSelected.keys()]),
      ),
    onSuccess: async (result) => {
      await invalidateParticipants();
      await invalidateAnalytics();
      setBulkOpen(false);
      setBulkSelected(new Map());
      setAssignError(null);
      const noManager = result.created.filter(
        (c) => c.reason === "NO_DIRECT_MANAGER",
      ).length;
      notifySuccess(
        `Asignados: ${result.created.length}. Ya estaban: ${result.alreadyAssigned.length}.`,
      );
      if (noManager > 0) {
        notifyInfo(
          `${noManager} sin evaluación de líder (sin manager directo).`,
        );
      }
    },
    onError: (error) => {
      setAssignError(getErrorMessage(error, "No se pudo asignar en lote."));
      notifyError(error, "No se pudo asignar en lote.");
    },
  });

  const excludeMutation = useMutation({
    mutationFn: (participantId: string) =>
      performanceApi.excludeParticipant(cycleId, participantId),
    onSuccess: async () => {
      await invalidateParticipants();
      await invalidateAnalytics();
      notifySuccess("Participante excluido");
    },
    onError: (error) =>
      notifyError(error, "No se pudo excluir al participante."),
  });

  const calculateMutation = useMutation({
    mutationFn: (participantId: string) =>
      performanceApi.calculateParticipantResult(cycleId, participantId),
    onSuccess: async () => {
      await invalidateParticipantsAndResults();
      notifySuccess("Resultado calculado");
    },
    onError: (error) =>
      notifyError(error, "No se pudo calcular el resultado."),
  });

  const releaseMutation = useMutation({
    mutationFn: (participantId: string) =>
      performanceApi.releaseParticipantResult(cycleId, participantId),
    onSuccess: async () => {
      await invalidateParticipantsAndResults();
      setReleaseTarget(null);
      notifySuccess("Resultado publicado");
    },
    onError: (error) =>
      notifyError(error, "No se pudo publicar el resultado."),
  });

  function openAdd() {
    setSelectedEmployeeId("");
    setEmployeeSearch("");
    setEmployeePage(1);
    setAssignError(null);
    setAddOpen(true);
  }

  function openBulk() {
    setBulkSelected(new Map());
    setEmployeeSearch("");
    setEmployeePage(1);
    setAssignError(null);
    setBulkOpen(true);
  }

  function toggleBulkEmployee(id: string, label: string, already: boolean) {
    if (already) return;
    setBulkSelected((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, { id, label });
      return next;
    });
  }

  if (participantsQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (participantsQuery.isError) {
    return (
      <ErrorState
        title="No se pudieron cargar los participantes"
        description={getErrorMessage(
          participantsQuery.error,
          "Error al cargar.",
        )}
        onRetry={() => void participantsQuery.refetch()}
      />
    );
  }

  const items = participantsQuery.data?.items ?? [];
  const total = participantsQuery.data?.total ?? 0;
  const totalPages = participantsQuery.data?.totalPages ?? 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Participantes</h2>
          <p className="text-sm text-muted-foreground">
            {canAssign
              ? "Asigna colaboradores al ciclo activo. Se materializan autoevaluación y, si hay manager directo, evaluación de líder."
              : "Solo se pueden asignar o excluir participantes cuando el ciclo está activo."}
          </p>
        </div>
        {canAssign ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={openBulk}>
              <Users className="h-4 w-4" />
              Asignar en lote
            </Button>
            <Button type="button" onClick={openAdd}>
              <Plus className="h-4 w-4" />
              Agregar participante
            </Button>
          </div>
        ) : null}
      </div>

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(searchInput.trim());
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre o email…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <Button type="submit" variant="outline">
          Buscar
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title="Sin participantes"
          description={
            canAssign
              ? "Agrega colaboradores ACTIVE para iniciar las evaluaciones del ciclo."
              : "Este ciclo aún no tiene participantes asignados."
          }
          action={
            canAssign ? (
              <Button type="button" onClick={openAdd}>
                Agregar participante
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
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Líder</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Autoeval.</TableHead>
                  <TableHead>Líder eval.</TableHead>
                  <TableHead>Resultado</TableHead>
                  {canAssign || canMutateResults ? (
                    <TableHead className="text-right">Acciones</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <ParticipantTableRow
                    key={row.id}
                    row={row}
                    cycleStatus={cycleStatus}
                    canAssign={canAssign}
                    canMutateResults={canMutateResults}
                    excluding={excludeMutation.isPending}
                    calculating={
                      calculateMutation.isPending &&
                      calculateMutation.variables === row.id
                    }
                    releasing={
                      releaseMutation.isPending &&
                      releaseMutation.variables === row.id
                    }
                    onExclude={() => excludeMutation.mutate(row.id)}
                    onCalculate={() => calculateMutation.mutate(row.id)}
                    onRelease={() => setReleaseTarget(row)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {items.map((row) => {
              const canCalculate = canCalculateParticipantResult({
                cycleStatus,
                participant: row,
              });
              const canRelease = canReleaseParticipantResult(
                row,
                cycleStatus,
              );
              return (
                <div
                  key={row.id}
                  className="space-y-2 rounded-lg border border-border bg-card p-4"
                >
                  <p className="font-medium">{employeeName(row.employee)}</p>
                  <p className="text-sm text-muted-foreground">
                    {row.employee.area.name} · {row.employee.position.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Líder:{" "}
                    {row.manager ? employeeName(row.manager) : "Sin manager"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={participantStatusVariant(row.status)}>
                      {PARTICIPANT_STATUS_LABELS[row.status]}
                    </Badge>
                    <Badge variant="secondary">
                      Auto:{" "}
                      {evalStatusLabel(
                        row.evaluations.self?.status,
                        row.evaluations.self?.scorePercentage,
                      )}
                    </Badge>
                    <Badge variant="secondary">
                      Líder:{" "}
                      {evalStatusLabel(
                        row.evaluations.manager?.status,
                        row.evaluations.manager?.scorePercentage,
                      )}
                    </Badge>
                    {row.result ? (
                      <Badge variant={resultStatusVariant(row.result.status)}>
                        {RESULT_STATUS_LABELS[row.result.status]} ·{" "}
                        {formatScorePercentage(row.result.overallScore)}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {row.result ? (
                      <Button type="button" variant="outline" size="sm" asChild>
                        <Link href={`/performance/results/${row.result.id}`}>
                          <Eye className="h-4 w-4" />
                          Ver resultado
                        </Link>
                      </Button>
                    ) : null}
                    {canMutateResults && canCalculate ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={calculateMutation.isPending}
                        onClick={() => calculateMutation.mutate(row.id)}
                      >
                        <Calculator className="h-4 w-4" />
                        Calcular resultado
                      </Button>
                    ) : null}
                    {canMutateResults && canRelease ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={releaseMutation.isPending}
                        onClick={() => setReleaseTarget(row)}
                      >
                        <Send className="h-4 w-4" />
                        Publicar
                      </Button>
                    ) : null}
                    {canAssign && row.status === "ACTIVE" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={excludeMutation.isPending}
                        onClick={() => excludeMutation.mutate(row.id)}
                      >
                        <UserMinus className="h-4 w-4" />
                        Excluir
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <PaginationControls
            page={page}
            totalPages={totalPages}
            total={total}
            onPageChange={setPage}
          />
        </>
      )}

      <Dialog
        open={releaseTarget != null}
        onOpenChange={(open) => {
          if (!open) setReleaseTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publicar resultado</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {RELEASE_RESULT_CONFIRMATION}
          </p>
          {releaseTarget ? (
            <p className="text-sm">
              Colaborador:{" "}
              <span className="font-medium">
                {employeeName(releaseTarget.employee)}
              </span>
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setReleaseTarget(null)}
              disabled={releaseMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={releaseMutation.isPending || !releaseTarget}
              onClick={() => {
                if (releaseTarget) {
                  releaseMutation.mutate(releaseTarget.id);
                }
              }}
            >
              {releaseMutation.isPending ? "Publicando…" : "Publicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EntityEditorShell
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Agregar participante"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!selectedEmployeeId) {
              setAssignError("Selecciona un colaborador.");
              return;
            }
            assignMutation.mutate(selectedEmployeeId);
          }}
        >
          <EmployeeSearchField
            value={employeeSearch}
            onChange={(v) => {
              setEmployeeSearch(v);
              setEmployeePage(1);
            }}
          />
          <EmployeePickList
            loading={employeesQuery.isLoading}
            items={(employeesQuery.data?.items ?? []).map((e) => ({
              id: e.id,
              label: `${employeeName(e)} · ${e.email}`,
              already: assignedEmployeeIds.has(e.id),
            }))}
            mode="single"
            selectedId={selectedEmployeeId}
            onSelect={setSelectedEmployeeId}
            page={employeePage}
            totalPages={employeesQuery.data?.totalPages ?? 1}
            total={employeesQuery.data?.total ?? 0}
            onPageChange={setEmployeePage}
          />
          {assignError ? (
            <p className="text-sm text-destructive" role="alert">
              {assignError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={assignMutation.isPending}>
              {assignMutation.isPending ? "Asignando…" : "Asignar"}
            </Button>
          </div>
        </form>
      </EntityEditorShell>

      <EntityEditorShell
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title="Asignar participantes en lote"
      >
        <div className="space-y-4">
          <EmployeeSearchField
            value={employeeSearch}
            onChange={(v) => {
              setEmployeeSearch(v);
              setEmployeePage(1);
            }}
          />
          {bulkSelected.size > 0 ? (
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <p className="mb-2 text-sm font-medium">
                Seleccionados ({bulkSelected.size})
              </p>
              <ul className="max-h-24 space-y-1 overflow-y-auto text-sm text-muted-foreground">
                {[...bulkSelected.values()].map((item) => (
                  <li key={item.id}>{item.label}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <EmployeePickList
            loading={employeesQuery.isLoading}
            items={(employeesQuery.data?.items ?? []).map((e) => ({
              id: e.id,
              label: `${employeeName(e)} · ${e.email}`,
              already: assignedEmployeeIds.has(e.id),
            }))}
            mode="multi"
            selectedIds={bulkSelected}
            onToggle={toggleBulkEmployee}
            page={employeePage}
            totalPages={employeesQuery.data?.totalPages ?? 1}
            total={employeesQuery.data?.total ?? 0}
            onPageChange={setEmployeePage}
          />
          {assignError ? (
            <p className="text-sm text-destructive" role="alert">
              {assignError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setBulkOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={bulkSelected.size === 0 || bulkMutation.isPending}
              onClick={() => bulkMutation.mutate()}
            >
              {bulkMutation.isPending
                ? "Asignando…"
                : `Asignar (${bulkSelected.size})`}
            </Button>
          </div>
        </div>
      </EntityEditorShell>
    </div>
  );
}

function ParticipantTableRow({
  row,
  cycleStatus,
  canAssign,
  canMutateResults,
  excluding,
  calculating,
  releasing,
  onExclude,
  onCalculate,
  onRelease,
}: {
  row: CycleParticipantListItem;
  cycleStatus: PerformanceCycleStatus;
  canAssign: boolean;
  canMutateResults: boolean;
  excluding: boolean;
  calculating: boolean;
  releasing: boolean;
  onExclude: () => void;
  onCalculate: () => void;
  onRelease: () => void;
}) {
  const canCalculate = canCalculateParticipantResult({
    cycleStatus,
    participant: row,
  });
  const canRelease = canReleaseParticipantResult(row, cycleStatus);
  const showActions = canAssign || canMutateResults;

  return (
    <TableRow>
      <TableCell>
        <div>
          <p className="font-medium">{employeeName(row.employee)}</p>
          <p className="text-xs text-muted-foreground">{row.employee.email}</p>
        </div>
      </TableCell>
      <TableCell>{row.employee.area.name}</TableCell>
      <TableCell>{row.employee.position.name}</TableCell>
      <TableCell>
        {row.manager ? employeeName(row.manager) : "—"}
      </TableCell>
      <TableCell>
        <Badge variant={participantStatusVariant(row.status)}>
          {PARTICIPANT_STATUS_LABELS[row.status]}
        </Badge>
      </TableCell>
      <TableCell>
        {evalStatusLabel(
          row.evaluations.self?.status,
          row.evaluations.self?.scorePercentage,
        )}
      </TableCell>
      <TableCell>
        {evalStatusLabel(
          row.evaluations.manager?.status,
          row.evaluations.manager?.scorePercentage,
        )}
      </TableCell>
      <TableCell>
        {row.result ? (
          <div className="space-y-1">
            <p className="font-medium">
              {formatScorePercentage(row.result.overallScore)}
            </p>
            <Badge variant={resultStatusVariant(row.result.status)}>
              {RESULT_STATUS_LABELS[row.result.status]}
            </Badge>
          </div>
        ) : (
          "—"
        )}
      </TableCell>
      {showActions ? (
        <TableCell className="text-right">
          <div className="flex flex-wrap justify-end gap-1">
            {row.result ? (
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link href={`/performance/results/${row.result.id}`}>
                  <Eye className="h-4 w-4" />
                  Ver
                </Link>
              </Button>
            ) : null}
            {canMutateResults && canCalculate ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={calculating}
                onClick={onCalculate}
              >
                <Calculator className="h-4 w-4" />
                Calcular resultado
              </Button>
            ) : null}
            {canMutateResults && canRelease ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={releasing}
                onClick={onRelease}
              >
                <Send className="h-4 w-4" />
                Publicar
              </Button>
            ) : null}
            {canAssign && row.status === "ACTIVE" ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={excluding}
                onClick={onExclude}
              >
                <UserMinus className="h-4 w-4" />
                Excluir
              </Button>
            ) : null}
          </div>
        </TableCell>
      ) : null}
    </TableRow>
  );
}

function EmployeeSearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="employee-search">Buscar colaborador</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="employee-search"
          className="pl-9"
          placeholder="Nombre o email…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

type PickItem = { id: string; label: string; already: boolean };

function EmployeePickList({
  loading,
  items,
  mode,
  selectedId,
  onSelect,
  selectedIds,
  onToggle,
  page,
  totalPages,
  total,
  onPageChange,
}: {
  loading: boolean;
  items: PickItem[];
  mode: "single" | "multi";
  selectedId?: string;
  onSelect?: (id: string) => void;
  selectedIds?: Map<string, { id: string; label: string }>;
  onToggle?: (id: string, label: string, already: boolean) => void;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (loading) {
    return <Skeleton className="h-40 w-full" />;
  }

  return (
    <div className="space-y-3">
      <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-border p-2">
        {items.length === 0 ? (
          <p className="p-2 text-sm text-muted-foreground">
            No hay colaboradores ACTIVE que coincidan.
          </p>
        ) : (
          items.map((item) => {
            const checked =
              mode === "single"
                ? selectedId === item.id
                : Boolean(selectedIds?.has(item.id));
            return (
              <label
                key={item.id}
                className={`flex cursor-pointer items-start gap-3 rounded-md p-2 text-sm hover:bg-muted/50 ${
                  item.already ? "opacity-60" : ""
                }`}
              >
                {mode === "multi" ? (
                  <Checkbox
                    checked={checked}
                    disabled={item.already}
                    onCheckedChange={() =>
                      onToggle?.(item.id, item.label, item.already)
                    }
                  />
                ) : (
                  <input
                    type="radio"
                    name="participant-employee"
                    className="mt-1"
                    checked={checked}
                    disabled={item.already}
                    onChange={() => {
                      if (!item.already) onSelect?.(item.id);
                    }}
                  />
                )}
                <span className="flex-1">
                  <span className="block font-medium">{item.label}</span>
                  {item.already ? (
                    <span className="text-xs text-muted-foreground">
                      Ya asignado a este ciclo
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })
        )}
      </div>
      <PaginationControls
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={onPageChange}
      />
    </div>
  );
}
