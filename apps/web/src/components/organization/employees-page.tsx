"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, KeyRound, Pencil, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { NO_BUSINESS_UNIT_LABEL } from "@/components/organization/area-form";
import {
  EmployeeForm,
  toCreatePayload,
  toUpdatePayload,
  type EmployeeFormValues,
} from "@/components/organization/employee-form";
import { IssueEmployeeAccessDialog } from "@/components/organization/issue-employee-access-dialog";
import {
  activeDefinitions,
  customFieldValuesFromRecord,
  emptyCustomFieldValues,
  toCustomFieldsPayload,
  type CustomFieldFormValues,
} from "@/components/organization/position-custom-fields";
import { EntityEditorShell } from "@/components/organization/entity-editor-shell";
import { FormSelect } from "@/components/organization/form-select";
import { PaginationControls } from "@/components/organization/pagination-controls";
import { OrgStatusBadge } from "@/components/organization/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import { getInitials } from "@/lib/utils";
import type { Employee, EmployeeStatus, ListEmployeesParams } from "@/types/organization";

function useEmployeeFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const params: ListEmployeesParams = {
    search: searchParams.get("search") ?? undefined,
    status: (searchParams.get("status") as EmployeeStatus | null) ?? undefined,
    areaId: searchParams.get("areaId") ?? undefined,
    positionId: searchParams.get("positionId") ?? undefined,
    businessUnitId: searchParams.get("businessUnitId") ?? undefined,
    page: Number(searchParams.get("page") ?? "1") || 1,
    limit: 20,
  };

  function setParams(next: Partial<ListEmployeesParams>) {
    const merged = { ...params, ...next };
    const sp = new URLSearchParams();
    if (merged.search) sp.set("search", merged.search);
    if (merged.status) sp.set("status", merged.status);
    if (merged.areaId) sp.set("areaId", merged.areaId);
    if (merged.positionId) sp.set("positionId", merged.positionId);
    if (merged.businessUnitId) sp.set("businessUnitId", merged.businessUnitId);
    if (merged.page && merged.page > 1) sp.set("page", String(merged.page));
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return { params, setParams };
}

export function EmployeesPageClient() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const { params, setParams } = useEmployeeFilters();
  const [searchInput, setSearchInput] = useState(params.search ?? "");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [customValues, setCustomValues] = useState<CustomFieldFormValues>({});
  const selectionKey = useMemo(
    () =>
      [
        params.search ?? "",
        params.status ?? "",
        params.areaId ?? "",
        params.positionId ?? "",
        params.businessUnitId ?? "",
        String(params.page ?? 1),
      ].join("\0"),
    [
      params.search,
      params.status,
      params.areaId,
      params.positionId,
      params.businessUnitId,
      params.page,
    ],
  );
  const [selection, setSelection] = useState<{ key: string; ids: string[] }>({
    key: selectionKey,
    ids: [],
  });
  const selectedIds = useMemo(
    () => (selection.key === selectionKey ? selection.ids : []),
    [selection, selectionKey],
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [accessEmployee, setAccessEmployee] = useState<Employee | null>(null);

  const employeesQuery = useQuery({
    queryKey: orgKeys.employees(companyId, params),
    queryFn: () => organizationApi.listEmployees(params),
  });
  const areasQuery = useQuery({
    queryKey: orgKeys.areas(companyId),
    queryFn: () => organizationApi.listAreas(),
  });
  const positionsQuery = useQuery({
    queryKey: orgKeys.positions(companyId),
    queryFn: () => organizationApi.listPositions(),
  });
  const buQuery = useQuery({
    queryKey: orgKeys.businessUnits(companyId),
    queryFn: () => organizationApi.listBusinessUnits(),
  });
  const fieldsQuery = useQuery({
    queryKey: orgKeys.positionCustomFields(companyId),
    queryFn: () => organizationApi.listPositionCustomFields(),
  });
  const activeEmployeeFields = activeDefinitions(
    fieldsQuery.data ?? [],
    "EMPLOYEE",
  );

  const areaMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const area of areasQuery.data ?? []) map.set(area.id, area.name);
    return map;
  }, [areasQuery.data]);
  const positionMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const position of positionsQuery.data ?? []) {
      map.set(position.id, position.name);
    }
    return map;
  }, [positionsQuery.data]);
  const buMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const bu of buQuery.data ?? []) map.set(bu.id, bu.name);
    return map;
  }, [buQuery.data]);
  const hasBusinessUnits = (buQuery.data?.length ?? 0) > 0;

  const saveMutation = useMutation({
    mutationFn: async (values: EmployeeFormValues) => {
      const customFields = toCustomFieldsPayload(
        activeEmployeeFields,
        customValues,
      );
      if (editing) {
        return organizationApi.updateEmployee(editing.id, {
          ...toUpdatePayload(values),
          customFields,
        });
      }
      return organizationApi.createEmployee({
        ...toCreatePayload(values),
        customFields,
      });
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({
        queryKey: orgKeys.all(companyId),
      });
      const wasCreate = !editing;
      setOpen(false);
      setEditing(null);
      setCustomValues({});
      setFormError(null);
      if (wasCreate) {
        notifySuccess(
          "Colaborador creado. Genera su contraseña con Acceso si debe entrar al sistema.",
        );
        setAccessEmployee(saved);
      } else {
        notifySuccess("Colaborador actualizado");
      }
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, "No se pudo guardar el colaborador."));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => organizationApi.deleteEmployees(selectedIds),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: orgKeys.all(companyId),
      });
      setSelection({ key: selectionKey, ids: [] });
      setConfirmDelete(false);
      notifySuccess(
        result.deleted === 1
          ? "Colaborador eliminado"
          : `${result.deleted} colaboradores eliminados`,
      );
    },
    onError: (error) => {
      notifyError(error, "No se pudieron eliminar los colaboradores.");
    },
  });

  const items = employeesQuery.data?.items ?? [];
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allVisibleSelected =
    items.length > 0 && items.every((employee) => selectedSet.has(employee.id));

  function toggleSelected(id: string, checked: boolean) {
    setSelection((current) => {
      const ids = current.key === selectionKey ? current.ids : [];
      return {
        key: selectionKey,
        ids: checked
          ? ids.includes(id)
            ? ids
            : [...ids, id]
          : ids.filter((item) => item !== id),
      };
    });
  }

  return (
    <div>
      <PageHeader
        title="Colaboradores"
        description="Personas de la estructura organizacional."
        actions={
          <>
            {selectedIds.length > 0 ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Eliminar ({selectedIds.length})
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={() => {
                setEditing(null);
                setCustomValues(emptyCustomFieldValues(activeEmployeeFields));
                setFormError(null);
                setOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Nuevo colaborador
            </Button>
          </>
        }
      />

      <div
        className={`mb-6 grid gap-3 sm:grid-cols-2 ${
          hasBusinessUnits ? "lg:grid-cols-6" : "lg:grid-cols-5"
        }`}
      >
        <form
          className="space-y-2 sm:col-span-2"
          onSubmit={(event) => {
            event.preventDefault();
            setParams({ search: searchInput.trim() || undefined, page: 1 });
          }}
        >
          <Label htmlFor="filter-search">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="filter-search"
              className="pl-9"
              placeholder="Buscar por nombre o email"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
        </form>
        <FormSelect
          id="filter-status"
          label="Estado"
          value={params.status ?? ""}
          onChange={(value) =>
            setParams({
              status: (value || undefined) as EmployeeStatus | undefined,
              page: 1,
            })
          }
          allowEmpty
          emptyLabel="Todos"
          options={[
            { value: "ACTIVE", label: "Activo" },
            { value: "INACTIVE", label: "Inactivo" },
            { value: "TERMINATED", label: "Terminado" },
          ]}
        />
        <FormSelect
          id="filter-area"
          label="Área"
          value={params.areaId ?? ""}
          onChange={(value) =>
            setParams({ areaId: value || undefined, page: 1 })
          }
          allowEmpty
          emptyLabel="Todas"
          options={(areasQuery.data ?? []).map((area) => ({
            value: area.id,
            label: area.name,
          }))}
        />
        {hasBusinessUnits ? (
          <FormSelect
            id="filter-bu"
            label="Unidad"
            value={params.businessUnitId ?? ""}
            onChange={(value) =>
              setParams({ businessUnitId: value || undefined, page: 1 })
            }
            allowEmpty
            emptyLabel="Todas"
            options={(buQuery.data ?? []).map((bu) => ({
              value: bu.id,
              label: bu.name,
            }))}
          />
        ) : null}
        <FormSelect
          id="filter-position"
          label="Cargo"
          value={params.positionId ?? ""}
          onChange={(value) =>
            setParams({ positionId: value || undefined, page: 1 })
          }
          allowEmpty
          emptyLabel="Todos"
          options={(positionsQuery.data ?? []).map((position) => ({
            value: position.id,
            label: position.name,
          }))}
        />
      </div>

      {employeesQuery.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : employeesQuery.isError ? (
        <ErrorState
          description={getErrorMessage(
            employeesQuery.error,
            "No se pudieron cargar colaboradores.",
          )}
          onRetry={() => void employeesQuery.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="Aún no hay colaboradores registrados."
          description="Crea el primer colaborador para comenzar."
          action={
            <Button type="button" onClick={() => setOpen(true)}>
              Nuevo colaborador
            </Button>
          }
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        allVisibleSelected
                          ? true
                          : items.some((employee) => selectedSet.has(employee.id))
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={(checked) => {
                        const enable = checked === true;
                        setSelection((current) => {
                          const ids =
                            current.key === selectionKey ? current.ids : [];
                          const next = new Set(ids);
                          for (const employee of items) {
                            if (enable) next.add(employee.id);
                            else next.delete(employee.id);
                          }
                          return { key: selectionKey, ids: [...next] };
                        });
                      }}
                      aria-label="Seleccionar todos"
                    />
                  </TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Cargo</TableHead>
                  {hasBusinessUnits ? <TableHead>Unidad</TableHead> : null}
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedSet.has(employee.id)}
                        onCheckedChange={(checked) =>
                          toggleSelected(employee.id, checked === true)
                        }
                        aria-label={`Seleccionar ${employee.firstName} ${employee.lastName}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {getInitials(employee.firstName, employee.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">
                          {employee.firstName} {employee.lastName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {employee.email}
                    </TableCell>
                    <TableCell>
                      {areaMap.get(employee.areaId) ?? "—"}
                    </TableCell>
                    <TableCell>
                      {positionMap.get(employee.positionId) ?? "—"}
                    </TableCell>
                    {hasBusinessUnits ? (
                      <TableCell>
                        {employee.businessUnitId
                          ? (buMap.get(employee.businessUnitId) ??
                            NO_BUSINESS_UNIT_LABEL)
                          : NO_BUSINESS_UNIT_LABEL}
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <OrgStatusBadge status={employee.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button asChild type="button" variant="ghost" size="sm">
                          <Link
                            href={`/organization/employees/${employee.id}`}
                            aria-label={`Ver perfil de ${employee.firstName}`}
                          >
                            <Eye className="h-4 w-4" />
                            Ver
                          </Link>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setAccessEmployee(employee)}
                          aria-label={`Dar acceso a ${employee.firstName}`}
                        >
                          <KeyRound className="h-4 w-4" />
                          Acceso
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(employee);
                            setCustomValues(
                              customFieldValuesFromRecord(
                                activeEmployeeFields,
                                employee,
                              ),
                            );
                            setFormError(null);
                            setOpen(true);
                          }}
                          aria-label={`Editar ${employee.firstName}`}
                        >
                          <Pencil className="h-4 w-4" />
                          Editar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {items.map((employee) => (
              <div
                key={employee.id}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    className="mt-1"
                    checked={selectedSet.has(employee.id)}
                    onCheckedChange={(checked) =>
                      toggleSelected(employee.id, checked === true)
                    }
                    aria-label={`Seleccionar ${employee.firstName} ${employee.lastName}`}
                  />
                  <Avatar>
                    <AvatarFallback>
                      {getInitials(employee.firstName, employee.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-medium">
                      {employee.firstName} {employee.lastName}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {employee.email}
                    </p>
                    <p className="text-sm">
                      {positionMap.get(employee.positionId) ?? "—"} ·{" "}
                      {areaMap.get(employee.areaId) ?? "—"}
                    </p>
                    <OrgStatusBadge status={employee.status} />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild type="button" variant="outline" size="sm">
                    <Link href={`/organization/employees/${employee.id}`}>
                      Ver perfil
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAccessEmployee(employee)}
                  >
                    Acceso
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(employee);
                      setCustomValues(
                        customFieldValuesFromRecord(
                          activeEmployeeFields,
                          employee,
                        ),
                      );
                      setFormError(null);
                      setOpen(true);
                    }}
                  >
                    Editar
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <PaginationControls
              page={employeesQuery.data?.page ?? 1}
              totalPages={employeesQuery.data?.totalPages ?? 1}
              total={employeesQuery.data?.total ?? 0}
              onPageChange={(page) => setParams({ page })}
            />
          </div>
        </>
      )}

      <EntityEditorShell
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Editar colaborador" : "Nuevo colaborador"}
      >
        <EmployeeForm
          key={editing?.id ?? "new"}
          initial={editing}
          areas={areasQuery.data ?? []}
          positions={positionsQuery.data ?? []}
          businessUnits={buQuery.data ?? []}
          customFieldDefinitions={activeEmployeeFields}
          customValues={customValues}
          onCustomValuesChange={setCustomValues}
          submitting={saveMutation.isPending}
          error={formError}
          onCancel={() => setOpen(false)}
          onSubmit={(values) => saveMutation.mutate(values)}
        />
      </EntityEditorShell>

      <IssueEmployeeAccessDialog
        employee={accessEmployee}
        open={Boolean(accessEmployee)}
        onOpenChange={(next) => {
          if (!next) setAccessEmployee(null);
        }}
      />

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar colaboradores</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Vas a eliminar {selectedIds.length}{" "}
              {selectedIds.length === 1 ? "colaborador" : "colaboradores"}.
              Esta acción los saca de la estructura y les quita el acceso.
            </p>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmDelete(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending || selectedIds.length === 0}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
