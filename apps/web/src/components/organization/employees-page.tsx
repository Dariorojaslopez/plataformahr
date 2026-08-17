"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Plus, Search } from "lucide-react";
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
import { EntityEditorShell } from "@/components/organization/entity-editor-shell";
import { FormSelect } from "@/components/organization/form-select";
import { PaginationControls } from "@/components/organization/pagination-controls";
import { OrgStatusBadge } from "@/components/organization/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
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
      if (editing) {
        return organizationApi.updateEmployee(
          editing.id,
          toUpdatePayload(values),
        );
      }
      return organizationApi.createEmployee(toCreatePayload(values));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: orgKeys.all(companyId),
      });
      setOpen(false);
      setEditing(null);
      setFormError(null);
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, "No se pudo guardar el colaborador."));
    },
  });

  const items = employeesQuery.data?.items ?? [];

  return (
    <div>
      <PageHeader
        title="Colaboradores"
        description="Personas de la estructura organizacional."
        actions={
          <Button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormError(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Nuevo colaborador
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 md:grid-cols-5">
        <form
          className="md:col-span-2"
          onSubmit={(event) => {
            event.preventDefault();
            setParams({ search: searchInput.trim() || undefined, page: 1 });
          }}
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nombre o email"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Buscar colaboradores"
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
      </div>
      <div className="mb-6 max-w-sm">
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
                          onClick={() => {
                            setEditing(employee);
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
                <div className="mt-3 flex gap-2">
                  <Button asChild type="button" variant="outline" size="sm">
                    <Link href={`/organization/employees/${employee.id}`}>
                      Ver perfil
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(employee);
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
          submitting={saveMutation.isPending}
          error={formError}
          onCancel={() => setOpen(false)}
          onSubmit={(values) => saveMutation.mutate(values)}
        />
      </EntityEditorShell>
    </div>
  );
}
