"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
import type { CalibrationSession, NineBoxCell } from "@/types/calibration";

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

export function CalibrationPageClient({
  view = "session",
}: {
  view?: "session" | "nine-box";
}) {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const isAdmin = (useSession().companyAccess?.roleCodes ?? []).includes(
    "CLIENT_ADMIN",
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const isNineBox = view === "nine-box";

  const sessionsQuery = useQuery({
    queryKey: performanceKeys.calibrationSessions(companyId),
    queryFn: () => performanceApi.listCalibrationSessions(),
  });

  const activeId =
    selectedId ?? sessionsQuery.data?.items[0]?.id ?? null;

  const sessionQuery = useQuery({
    queryKey: performanceKeys.calibrationSession(companyId, activeId ?? ""),
    queryFn: () => performanceApi.getCalibrationSession(activeId!),
    enabled: !!activeId,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      performanceApi.createCalibrationSession({ name: "Calibración" }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({
        queryKey: performanceKeys.calibrationSessions(companyId),
      });
      setSelectedId(created.id);
      notifySuccess("Sesión de calibración creada");
    },
    onError: (error) => notifyError(error, "No se pudo crear la sesión."),
  });

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
        title={isNineBox ? "9Box" : "Calibración"}
        description={
          isNineBox
            ? "Cuadrante de potencial y desempeño. Configura etiquetas y colores, y ubica a las personas de la sesión."
            : "Invitados, líderes y ventana de la sesión. El 9Box se abre en el menú 9Box."
        }
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
          value={activeId ?? ""}
          onChange={(id) => {
            setSelectedId(id);
          }}
          options={(sessionsQuery.data?.items ?? []).map((item) => ({
            value: item.id,
            label: item.name,
          }))}
        />
      ) : null}

      {!activeId ? (
        <EmptyState
          title={isNineBox ? "Sin 9Box" : "Sin sesión de calibración"}
          description={
            isAdmin
              ? isNineBox
                ? "Crea una sesión para ver el 9Box y configurar etiquetas."
                : "Crea una sesión para invitar personas y definir la ventana."
              : "El administrador aún no configuró una sesión."
          }
        />
      ) : sessionQuery.isError ? (
        <ErrorState
          title="No se pudo cargar la sesión"
          description={getErrorMessage(sessionQuery.error, "Error")}
          onRetry={() => void sessionQuery.refetch()}
        />
      ) : !sessionQuery.data ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <CalibrationSessionEditor
          key={sessionQuery.data.id}
          companyId={companyId}
          isAdmin={isAdmin}
          session={sessionQuery.data}
          view={view}
        />
      )}
    </div>
  );
}

function CalibrationSessionEditor({
  companyId,
  isAdmin,
  session,
  view,
}: {
  companyId: string;
  isAdmin: boolean;
  session: CalibrationSession;
  view: "session" | "nine-box";
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(session.name);
  const [opensAt, setOpensAt] = useState(toDatetimeLocal(session.opensAt));
  const [closesAt, setClosesAt] = useState(toDatetimeLocal(session.closesAt));
  const [cells, setCells] = useState<NineBoxCell[]>(
    session.cells.length === 9 ? session.cells : DEFAULT_NINE_BOX_CELLS,
  );
  const [inviteeIds, setInviteeIds] = useState(
    session.invitees.map((row) => row.id),
  );
  const [leaderIds, setLeaderIds] = useState(
    session.leaders.map((row) => row.id),
  );
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeePage, setEmployeePage] = useState(1);
  const [pendingMove, setPendingMove] = useState<{
    employeeId: string;
    label: string;
    row: number;
    col: number;
  } | null>(null);
  const [justification, setJustification] = useState("");

  const placementsQuery = useQuery({
    queryKey: performanceKeys.calibrationPlacements(companyId, session.id),
    queryFn: () => performanceApi.listCalibrationPlacements(session.id),
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
    enabled: view === "session",
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      view === "nine-box"
        ? performanceApi.updateCalibrationSession(session.id, { cells })
        : performanceApi.updateCalibrationSession(session.id, {
            name: name.trim(),
            opensAt: fromDatetimeLocal(opensAt),
            closesAt: fromDatetimeLocal(closesAt),
            inviteeEmployeeIds: inviteeIds,
            leaderEmployeeIds: leaderIds,
          }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: performanceKeys.all(companyId),
      });
      notifySuccess(
        view === "nine-box" ? "9Box guardado" : "Calibración guardada",
      );
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
      performanceApi.saveCalibrationPlacement(session.id, {
        employeeId: pendingMove!.employeeId,
        row: pendingMove!.row,
        col: pendingMove!.col,
        justification,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: performanceKeys.calibrationPlacements(companyId, session.id),
      });
      setPendingMove(null);
      setJustification("");
      notifySuccess("Posición actualizada");
    },
    onError: (error) => notifyError(error, "No se pudo guardar el movimiento."),
  });

  const employees = employeesQuery.data?.items ?? [];
  const isNineBox = view === "nine-box";

  return (
    <>
      {isNineBox ? null : (
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
        </>
      )}

      {isNineBox ? (
        <>
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
                      label: item ? employeeLabel(item.employee) : personId,
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

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Etiquetas y colores 9Box</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {[2, 1, 0].flatMap((row) =>
                [0, 1, 2].map((col) => {
                  const cell = cells.find(
                    (item) => item.row === row && item.col === col,
                  ) ?? {
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
                          setCells((prev) =>
                            prev.map((item) =>
                              item.row === row && item.col === col
                                ? { ...item, label: e.target.value }
                                : item,
                            ),
                          );
                        }}
                      />
                      <Input
                        type="color"
                        value={cell.color}
                        disabled={!isAdmin}
                        aria-label={`Color ${cell.label}`}
                        onChange={(e) => {
                          setCells((prev) =>
                            prev.map((item) =>
                              item.row === row && item.col === col
                                ? { ...item, color: e.target.value }
                                : item,
                            ),
                          );
                        }}
                      />
                    </div>
                  );
                }),
              )}
            </div>
          </section>
        </>
      ) : null}

      {isAdmin ? (
        <Button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending
            ? "Guardando…"
            : isNineBox
              ? "Guardar 9Box"
              : "Guardar calibración"}
        </Button>
      ) : null}

      {isNineBox ? (
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
      ) : null}
    </>
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
