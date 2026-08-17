"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  emptyVacancyRequestForm,
  toCreateVacancyRequestPayload,
  toUpdateVacancyRequestPayload,
  VacancyRequestForm,
  vacancyRequestToForm,
  type VacancyRequestFormValues,
} from "@/components/ats/vacancy-request-form";
import { useSession } from "@/components/auth/session-provider";
import { EntityEditorShell } from "@/components/organization/entity-editor-shell";
import { FormSelect } from "@/components/organization/form-select";
import { PaginationControls } from "@/components/organization/pagination-controls";
import { Badge } from "@/components/ui/badge";
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
import { atsApi, atsKeys } from "@/lib/api/ats";
import { getErrorMessage } from "@/lib/api/errors";
import { organizationApi, orgKeys } from "@/lib/api/organization";
import {
  formatDateShort,
  formatEmployeeName,
  VACANCY_REQUEST_STATUS_LABELS,
  VACANCY_REQUEST_TYPE_LABELS,
  vacancyRequestStatusVariant,
} from "@/lib/ats/labels";
import {
  describeVacancyRequesterField,
  findLinkedEmployeeId,
  validateRequesterSelection,
  vacancyRequestSaveError,
} from "@/lib/ats/vacancy-requester";
import type {
  ListVacancyRequestsParams,
  VacancyRequest,
  VacancyRequestStatus,
  VacancyRequestType,
} from "@/types/ats";

function requestTitle(request: VacancyRequest): string {
  if (request.type === "EXISTING_POSITION") {
    return request.existingPosition?.name ?? "Cargo existente";
  }
  return request.requestedPositionName ?? "Cargo nuevo";
}

function useRequestFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const params: ListVacancyRequestsParams = {
    search: searchParams.get("search") ?? undefined,
    status:
      (searchParams.get("status") as VacancyRequestStatus | null) ?? undefined,
    type: (searchParams.get("type") as VacancyRequestType | null) ?? undefined,
    requestedByEmployeeId:
      searchParams.get("requestedByEmployeeId") ?? undefined,
    page: Number(searchParams.get("page") ?? "1") || 1,
    limit: 20,
  };

  function setParams(next: Partial<ListVacancyRequestsParams>) {
    const merged = { ...params, ...next };
    const sp = new URLSearchParams();
    if (merged.search) sp.set("search", merged.search);
    if (merged.status) sp.set("status", merged.status);
    if (merged.type) sp.set("type", merged.type);
    if (merged.requestedByEmployeeId) {
      sp.set("requestedByEmployeeId", merged.requestedByEmployeeId);
    }
    if (merged.page && merged.page > 1) sp.set("page", String(merged.page));
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return { params, setParams };
}

export function VacancyRequestsPageClient() {
  const companyId = useCompanyId();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { params, setParams } = useRequestFilters();
  const [searchInput, setSearchInput] = useState(params.search ?? "");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VacancyRequest | null>(null);
  const [form, setForm] = useState(emptyVacancyRequestForm());
  const [formError, setFormError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: atsKeys.vacancyRequests(companyId, params),
    queryFn: () => atsApi.listVacancyRequests(params),
  });
  const positionsQuery = useQuery({
    queryKey: orgKeys.positions(companyId),
    queryFn: () => organizationApi.listPositions(),
  });
  const areasQuery = useQuery({
    queryKey: orgKeys.areas(companyId),
    queryFn: () => organizationApi.listAreas(),
  });
  const levelsQuery = useQuery({
    queryKey: orgKeys.jobLevels(companyId),
    queryFn: () => organizationApi.listJobLevels(),
  });
  const employeesQuery = useQuery({
    queryKey: orgKeys.employees(companyId, { page: 1, limit: 100 }),
    queryFn: () => organizationApi.listEmployees({ page: 1, limit: 100 }),
  });

  const positionOptions = useMemo(
    () =>
      (positionsQuery.data ?? []).map((p) => ({
        value: p.id,
        label: p.name,
      })),
    [positionsQuery.data],
  );
  const areaOptions = useMemo(
    () =>
      (areasQuery.data ?? []).map((a) => ({ value: a.id, label: a.name })),
    [areasQuery.data],
  );
  const levelOptions = useMemo(
    () =>
      (levelsQuery.data ?? []).map((l) => ({ value: l.id, label: l.name })),
    [levelsQuery.data],
  );
  const employeeOptions = useMemo(
    () =>
      (employeesQuery.data?.items ?? []).map((e) => ({
        value: e.id,
        label: `${e.firstName} ${e.lastName}`,
      })),
    [employeesQuery.data],
  );
  const linkedEmployeeId = findLinkedEmployeeId(
    employeesQuery.data?.items ?? [],
    user?.id,
  );
  const linkedEmployeeExists = Boolean(linkedEmployeeId);
  // This screen lists collaborators for on-behalf requests. The API does not
  // expose membership roles; PROXY_REQUESTER_ROLE_CODES remain backend-only.
  const canProxyRequester = true;
  const requesterField = describeVacancyRequesterField({
    linkedEmployeeExists,
    canProxyRequester,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: VacancyRequestFormValues) => {
      if (editing) {
        return atsApi.updateVacancyRequest(
          editing.id,
          toUpdateVacancyRequestPayload(values),
        );
      }
      return atsApi.createVacancyRequest(toCreateVacancyRequestPayload(values));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: atsKeys.all(companyId),
      });
      setOpen(false);
      setEditing(null);
      setForm(emptyVacancyRequestForm());
      setFormError(null);
    },
    onError: (error) => {
      setFormError(vacancyRequestSaveError(error));
    },
  });

  function submitForm() {
    const requesterError = validateRequesterSelection(
      form.requestedByEmployeeId,
      requesterField,
    );
    if (requesterError) {
      setFormError(requesterError);
      return;
    }
    setFormError(null);
    saveMutation.mutate(form);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyVacancyRequestForm());
    setFormError(null);
    setOpen(true);
  }

  function openEdit(request: VacancyRequest) {
    if (request.status !== "DRAFT") return;
    setEditing(request);
    setForm(vacancyRequestToForm(request));
    setFormError(null);
    setOpen(true);
  }

  const items = listQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Solicitudes de vacante"
        description="Solicitudes de cobertura y flujo de aprobación."
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus className="size-4" aria-hidden />
            Nueva solicitud
          </Button>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <form
          className="flex min-w-[16rem] flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setParams({ search: searchInput.trim() || undefined, page: 1 });
          }}
        >
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar cargo…"
            aria-label="Buscar solicitudes"
          />
          <Button type="submit" variant="secondary" aria-label="Buscar">
            <Search className="size-4" />
          </Button>
        </form>
        <FormSelect
          id="vr-filter-status"
          label="Estado"
          className="w-full sm:w-48"
          value={params.status ?? ""}
          onChange={(status) =>
            setParams({
              status: (status || undefined) as VacancyRequestStatus | undefined,
              page: 1,
            })
          }
          allowEmpty
          emptyLabel="Todos"
          options={Object.entries(VACANCY_REQUEST_STATUS_LABELS).map(
            ([value, label]) => ({ value, label }),
          )}
        />
        <FormSelect
          id="vr-filter-type"
          label="Tipo"
          className="w-full sm:w-48"
          value={params.type ?? ""}
          onChange={(type) =>
            setParams({
              type: (type || undefined) as VacancyRequestType | undefined,
              page: 1,
            })
          }
          allowEmpty
          emptyLabel="Todos"
          options={Object.entries(VACANCY_REQUEST_TYPE_LABELS).map(
            ([value, label]) => ({ value, label }),
          )}
        />
        <FormSelect
          id="vr-filter-requester"
          label="Solicitante"
          className="w-full sm:w-56"
          value={params.requestedByEmployeeId ?? ""}
          onChange={(requestedByEmployeeId) =>
            setParams({
              requestedByEmployeeId: requestedByEmployeeId || undefined,
              page: 1,
            })
          }
          allowEmpty
          emptyLabel="Todos"
          options={employeeOptions}
        />
      </div>

      {listQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : null}

      {listQuery.isError ? (
        <ErrorState
          title="No se pudieron cargar las solicitudes"
          description={getErrorMessage(
            listQuery.error,
            "Error al cargar solicitudes.",
          )}
          onRetry={() => void listQuery.refetch()}
        />
      ) : null}

      {listQuery.isSuccess && items.length === 0 ? (
        <EmptyState
          title="Aún no hay solicitudes de vacante."
          action={
            <Button type="button" onClick={openCreate}>
              Nueva solicitud
            </Button>
          }
        />
      ) : null}

      {items.length > 0 ? (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cargo solicitado</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">
                      {requestTitle(request)}
                    </TableCell>
                    <TableCell>
                      {VACANCY_REQUEST_TYPE_LABELS[request.type]}
                    </TableCell>
                    <TableCell>
                      {formatEmployeeName(request.requestedByEmployee)}
                    </TableCell>
                    <TableCell>{request.requestedHeadcount}</TableCell>
                    <TableCell>
                      <Badge
                        variant={vacancyRequestStatusVariant(request.status)}
                      >
                        {VACANCY_REQUEST_STATUS_LABELS[request.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDateShort(request.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link
                            href={`/ats/vacancy-requests/${request.id}`}
                            aria-label="Ver solicitud"
                          >
                            <Eye className="size-4" />
                          </Link>
                        </Button>
                        {request.status === "DRAFT" ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Editar solicitud"
                            onClick={() => openEdit(request)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {items.map((request) => (
              <div
                key={request.id}
                className="rounded-lg border border-border p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{requestTitle(request)}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatEmployeeName(request.requestedByEmployee)}
                    </p>
                  </div>
                  <Badge variant={vacancyRequestStatusVariant(request.status)}>
                    {VACANCY_REQUEST_STATUS_LABELS[request.status]}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {VACANCY_REQUEST_TYPE_LABELS[request.type]} ·{" "}
                  {request.requestedHeadcount} ·{" "}
                  {formatDateShort(request.createdAt)}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/ats/vacancy-requests/${request.id}`}>Ver</Link>
                  </Button>
                  {request.status === "DRAFT" ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => openEdit(request)}
                    >
                      Editar
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <PaginationControls
            page={listQuery.data?.page ?? 1}
            totalPages={listQuery.data?.totalPages ?? 1}
            total={listQuery.data?.total ?? 0}
            onPageChange={(page) => setParams({ page })}
          />
        </>
      ) : null}

      <EntityEditorShell
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Editar solicitud" : "Nueva solicitud"}
      >
        <VacancyRequestForm
          values={form}
          onChange={setForm}
          onCancel={() => setOpen(false)}
          onSubmit={submitForm}
          submitting={saveMutation.isPending}
          error={formError}
          positions={positionOptions}
          areas={areaOptions}
          jobLevels={levelOptions}
          employees={employeeOptions}
          linkedEmployeeExists={linkedEmployeeExists}
          canProxyRequester={canProxyRequester}
          submitLabel={editing ? "Guardar cambios" : "Crear solicitud"}
        />
      </EntityEditorShell>
    </div>
  );
}
