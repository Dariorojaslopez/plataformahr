"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/components/auth/session-provider";
import { NineBoxGrid, nineBoxPeopleKey } from "@/components/performance/nine-box-grid";
import { FormSelect } from "@/components/organization/form-select";
import { PaginationControls } from "@/components/organization/pagination-controls";
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
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCompanyId } from "@/hooks/use-company-id";
import { getErrorMessage } from "@/lib/api/errors";
import { organizationApi, orgKeys } from "@/lib/api/organization";
import { performanceApi, performanceKeys } from "@/lib/api/performance";
import { DEFAULT_NINE_BOX_CELLS } from "@/lib/performance/nine-box";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type { NineBoxCell } from "@/types/calibration";

function employeeLabel(row: { firstName: string; lastName: string }) {
  return `${row.firstName} ${row.lastName}`.trim();
}

function toDatetimeLocal(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocal(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function CalibrationPageClient() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const isAdmin = (useSession().companyAccess?.roleCodes ?? []).includes(
    "CLIENT_ADMIN",
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("Calibración");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [cells, setCells] = useState<NineBoxCell[]>(DEFAULT_NINE_BOX_CELLS);
  const [inviteeIds, setInviteeIds] = useState<string[]>([]);
  const [leaderIds, setLeaderIds] = useState<string[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeePage, setEmployeePage] = useState(1);
  const [pendingMove, setPendingMove] = useState<{
    employeeId: string;
    label: string;
    row: number;
    col: number;
  } | null>(null);
  const [justification, setJustification] = useState("");

  const sessionsQuery = useQuery({
    queryKey: performanceKeys.calibrationSessions(companyId),
    queryFn: () => performanceApi.listCalibrationSessions(),
  });

  const selected =
    sessionsQuery.data?.items.find((item) => item.id === selectedId) ??
    sessionsQuery.data?.items[0] ??
    null;

  const sessionQuery = useQuery({
    queryKey: performanceKeys.calibrationSession(companyId, selected?.id ?? ""),
    queryFn: () => performanceApi.getCalibrationSession(selected!.id),
    enabled: !!selected?.id,
  });

  const session = sessionQuery.data ?? selected;

  useEffect(() => {
    if (!session) return;
    setSelectedId(session.id);
    setName(session.name);
    setOpensAt(toDatetimeLocal(session.opensAt));
    setClosesAt(toDatetimeLocal(session.closesAt));
    setCells(session.cells.length === 9 ? session.cells : DEFAULT_NINE_BOX_CELLS);
    setInviteeIds(session.invitees.map((row) => row.id));
    setLeaderIds(session.leaders.map((row) => row.id));
  }, [session?.id]);

  const placementsQuery = useQuery({
    queryKey: performanceKeys.calibrationPlacements(
      companyId,
      session?.id ?? "",
    ),
    queryFn: () => performanceApi.listCalibrationPlacements(session!.id),
    enabled: !!session?.id,
  });

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
  });

  const createMutation = useMutation({
    mutationFn: () =>
      performanceApi.createCalibrationSession({ name: name.trim() || "Calibración" }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({
        queryKey: performanceKeys.calibrationSessions(companyId),
      });
      setSelectedId(created.id);
      notifySuccess("Sesión de calibración creada");
    },
    onError: (error) => notifyError(error, "No se pudo crear la sesión."),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      performanceApi.updateCalibrationSession(session!.id, {
        name: name.trim(),
        opensAt: fromDatetimeLocal(opensAt),
        closesAt: fromDatetimeLocal(closesAt),
        cells,
        inviteeEmployeeIds: inviteeIds,
        leaderEmployeeIds: leaderIds,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: performanceKeys.all(companyId),
      });
      notifySuccess("Calibración guardada");
    },
    onError: (error) => notifyError(error, "No se pudo guardar."),
  });

  const peopleByCell = useMemo(() => {
    const map = new Map<string, Array<{ id: string; label: string }>>();
    for (const item of placementsQuery.data?.items ?? []) {
      if (item.row == null || item.col == null) continue;
      const key = nineBoxPeopleKey(item.row, item.col);
      const list = map.get(key) ?? [];
      list.push({
        id: item.employee.id,
        label: employeeLabel(item.employee),
      });
      map.set(key, list);
    }
    return map;
  }, [placementsQuery.data]);

  const unplaced = (placementsQuery.data?.items ?? []).filter(
    (item) => item.row == null || item.col == null,
  );

  const placeMutation = useMutation({
    mutationFn: () =>
      performanceApi.saveCalibrationPlacement(session!.id, {
        employeeId: pendingMove!.employeeId,
        row: pendingMove!.row,
        col: pendingMove!.col,
        justification,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: performanceKeys.calibrationPlacements(
          companyId,
          session?.id ?? "",
        ),
      });
      setPendingMove(null);
      setJustification("");
      notifySuccess("Posición actualizada");
    },
    onError: (error) => notifyError(error, "No se pudo guardar el movimiento."),
  });

  const employees = employeesQuery.data?.items ?? [];

  if (sessionsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (sessionsQuery.isError) {
    return (
      <ErrorState
        title="No se pudo cargar calibración"
        description={getErrorMessage(sessionsQuery.error, "Error")}
        onRetry={() => void sessionsQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calibración"
        description="Etiquetas y colores del 9Box, invitados, líderes y ventana de la sesión. Solo el administrador puede modificar."
        actions={
          isAdmin ? (
            <Button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              Nueva sesión
            </Button>
          ) : null
        }
      />

      {(sessionsQuery.data?.items.length ?? 0) > 1 ? (
        <FormSelect
          id="cal-session"
          label="Sesión"
          value={session?.id ?? ""}
          onChange={(id) => {
            setSelectedId(id);
          }}
          options={(sessionsQuery.data?.items ?? []).map((item) => ({
            value: item.id,
            label: item.name,
          }))}
        />
      ) : null}

      {!session ? (
        <EmptyState
          title="Sin sesión de calibración"
          description={
            isAdmin
              ? "Crea una sesión para configurar el 9Box y los invitados."
              : "El administrador aún no configuró una sesión."
          }
        />
      ) : (
        <>
          <section className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-3">
              <Label htmlFor="cal-name">Nombre</Label>
              <Input
                id="cal-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cal-open">Apertura</Label>
              <Input
                id="cal-open"
                type="datetime-local"
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cal-close">Cierre</Label>
              <Input
                id="cal-close"
                type="datetime-local"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                disabled={!isAdmin}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Etiquetas y colores 9Box</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {[2, 1, 0].flatMap((row) =>
                [0, 1, 2].map((col) => {
                  const index = cells.findIndex(
                    (cell) => cell.row === row && cell.col === col,
                  );
                  const cell = cells[index] ?? {
                    row,
                    col,
                    label: "",
                    color: "#64748b",
                  };
                  return (
                    <div
                      key={`${row}:${col}`}
                      className="space-y-2 rounded-lg border p-3"
                    >
                      <Label htmlFor={`cell-${row}-${col}`}>
                        Fila {row + 1}, col {col + 1}
                      </Label>
                      <Input
                        id={`cell-${row}-${col}`}
                        value={cell.label}
                        disabled={!isAdmin}
                        onChange={(e) => {
                          const next = cells.map((item) =>
                            item.row === row && item.col === col
                              ? { ...item, label: e.target.value }
                              : item,
                          );
                          setCells(next);
                        }}
                      />
                      <Input
                        type="color"
                        value={cell.color}
                        disabled={!isAdmin}
                        aria-label={`Color ${cell.label}`}
                        onChange={(e) => {
                          const next = cells.map((item) =>
                            item.row === row && item.col === col
                              ? { ...item, color: e.target.value }
                              : item,
                          );
                          setCells(next);
                        }}
                      />
                    </div>
                  );
                }),
              )}
            </div>
          </section>

          <PeoplePicker
            title="Personas invitadas a la sesión"
            employees={employees}
            selectedIds={inviteeIds}
            disabled={!isAdmin}
            onToggle={(id, checked) => {
              setInviteeIds((prev) =>
                checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id),
              );
            }}
            search={employeeSearch}
            onSearch={setEmployeeSearch}
            page={employeePage}
            totalPages={employeesQuery.data?.totalPages ?? 1}
            total={employeesQuery.data?.total ?? 0}
            onPageChange={setEmployeePage}
          />

          <PeoplePicker
            title="Líderes de la sesión"
            description="El 9Box muestra a las personas a cargo de estos líderes."
            employees={employees}
            selectedIds={leaderIds}
            disabled={!isAdmin}
            onToggle={(id, checked) => {
              setLeaderIds((prev) =>
                checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id),
              );
            }}
            search={employeeSearch}
            onSearch={setEmployeeSearch}
            page={employeePage}
            totalPages={employeesQuery.data?.totalPages ?? 1}
            total={employeesQuery.data?.total ?? 0}
            onPageChange={setEmployeePage}
          />

          {isAdmin ? (
            <Button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Guardando…" : "Guardar calibración"}
            </Button>
          ) : null}

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">9Box de la sesión</h2>
            {placementsQuery.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <>
              <NineBoxGrid
                cells={cells}
                peopleByCell={peopleByCell}
                onDropPerson={(personId, row, col) => {
                  const item = placementsQuery.data?.items.find(
                    (rowItem) => rowItem.employee.id === personId,
                  );
                  setPendingMove({
                    employeeId: personId,
                    label: item
                      ? employeeLabel(item.employee)
                      : personId,
                    row,
                    col,
                  });
                }}
              />
              {unplaced.length > 0 ? (
                <div className="rounded-lg border border-dashed p-3 text-sm">
                  <p className="mb-2 text-muted-foreground">Sin ubicar</p>
                  <ul className="flex flex-wrap gap-2">
                    {unplaced.map((item) => (
                      <li
                        key={item.employee.id}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData(
                            "text/plain",
                            item.employee.id,
                          );
                        }}
                        className="cursor-grab rounded-md border px-2 py-1"
                      >
                        {employeeLabel(item.employee)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
            )}
          </section>
        </>
      )}

      <Dialog
        open={Boolean(pendingMove)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingMove(null);
            setJustification("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Justificar el movimiento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {pendingMove
              ? `Mover a ${pendingMove.label} al cuadrante ${pendingMove.row + 1},${pendingMove.col + 1}.`
              : null}
          </p>
          <Textarea
            value={justification}
            rows={4}
            onChange={(event) => setJustification(event.target.value)}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPendingMove(null);
                setJustification("");
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!justification.trim() || placeMutation.isPending}
              onClick={() => placeMutation.mutate()}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PeoplePicker({
  title,
  description,
  employees,
  selectedIds,
  disabled,
  onToggle,
  search,
  onSearch,
  page,
  totalPages,
  total,
  onPageChange,
}: {
  title: string;
  description?: string;
  employees: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  }>;
  selectedIds: string[];
  disabled?: boolean;
  onToggle: (id: string, checked: boolean) => void;
  search: string;
  onSearch: (value: string) => void;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const selected = new Set(selectedIds);
  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {selectedIds.length} seleccionados
        </p>
      </div>
      <Input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Buscar…"
        disabled={disabled}
      />
      <ul className="space-y-2">
        {employees.map((row) => (
          <li key={row.id} className="flex items-center gap-2">
            <Checkbox
              checked={selected.has(row.id)}
              disabled={disabled}
              onCheckedChange={(value) => onToggle(row.id, value === true)}
              aria-label={employeeLabel(row)}
            />
            <span className="text-sm">
              {employeeLabel(row)}{" "}
              <span className="text-muted-foreground">{row.email}</span>
            </span>
          </li>
        ))}
      </ul>
      <PaginationControls
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={onPageChange}
      />
    </section>
  );
}
