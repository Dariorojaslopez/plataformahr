"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
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
import {
  formatDateShort,
  VACANCY_STATUS_LABELS,
  vacancyStatusVariant,
} from "@/lib/ats/labels";
import {
  getVacancyStatusActions,
  VACANCY_STATUS_ACTION_LABELS,
} from "@/lib/ats/transitions";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type { ListVacanciesParams, Vacancy, VacancyStatus } from "@/types/ats";

function useVacancyFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const params: ListVacanciesParams = {
    search: searchParams.get("search") ?? undefined,
    status: (searchParams.get("status") as VacancyStatus | null) ?? undefined,
    page: Number(searchParams.get("page") ?? "1") || 1,
    limit: 20,
  };
  function setParams(next: Partial<ListVacanciesParams>) {
    const merged = { ...params, ...next };
    const sp = new URLSearchParams();
    if (merged.search) sp.set("search", merged.search);
    if (merged.status) sp.set("status", merged.status);
    if (merged.page && merged.page > 1) sp.set("page", String(merged.page));
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }
  return { params, setParams };
}

export function VacanciesPageClient() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const { params, setParams } = useVacancyFilters();
  const [searchInput, setSearchInput] = useState(params.search ?? "");
  const [actionError, setActionError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: atsKeys.vacancies(companyId, params),
    queryFn: () => atsApi.listVacancies(params),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: VacancyStatus }) =>
      atsApi.updateVacancy(id, { status }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: atsKeys.all(companyId) });
      setActionError(null);
      notifySuccess("Estado de vacante actualizado");
    },
    onError: (error) => {
      setActionError(getErrorMessage(error, "No se pudo actualizar el estado."));
      notifyError(error, "No se pudo actualizar el estado.");
    },
  });

  const items = listQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vacantes"
        description="Vacantes abiertas y su cobertura."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
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
            placeholder="Buscar vacante…"
            aria-label="Buscar vacantes"
          />
          <Button type="submit" variant="secondary" aria-label="Buscar">
            <Search className="size-4" />
          </Button>
        </form>
        <FormSelect
          id="vac-status"
          label="Estado"
          className="w-full sm:w-48"
          value={params.status ?? ""}
          onChange={(status) =>
            setParams({
              status: (status || undefined) as VacancyStatus | undefined,
              page: 1,
            })
          }
          allowEmpty
          emptyLabel="Todos"
          options={Object.entries(VACANCY_STATUS_LABELS).map(
            ([value, label]) => ({ value, label }),
          )}
        />
      </div>

      {actionError ? (
        <p className="text-sm text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}

      {listQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : null}

      {listQuery.isError ? (
        <ErrorState
          title="No se pudieron cargar las vacantes"
          description={getErrorMessage(listQuery.error, "Error al cargar.")}
          onRetry={() => void listQuery.refetch()}
        />
      ) : null}

      {listQuery.isSuccess && items.length === 0 ? (
        <EmptyState title="No hay vacantes disponibles." />
      ) : null}

      {items.length > 0 ? (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vacante</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Plazas</TableHead>
                  <TableHead>Cubiertas</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Publicación</TableHead>
                  <TableHead>Apertura</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((vacancy) => (
                  <VacancyRow
                    key={vacancy.id}
                    vacancy={vacancy}
                    pending={statusMutation.isPending}
                    onStatus={(status) =>
                      statusMutation.mutate({ id: vacancy.id, status })
                    }
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {items.map((vacancy) => (
              <div
                key={vacancy.id}
                className="space-y-3 rounded-lg border border-border p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{vacancy.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {vacancy.position?.name ?? "—"} ·{" "}
                      {vacancy.area?.name ?? "—"}
                    </p>
                  </div>
                  <Badge variant={vacancyStatusVariant(vacancy.status)}>
                    {VACANCY_STATUS_LABELS[vacancy.status]}
                  </Badge>
                </div>
                <Badge variant={vacancy.publishedAt ? "success" : "secondary"}>
                  {vacancy.publishedAt ? "Publicada" : "No publicada"}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  {vacancy.filledCount}/{vacancy.headcount} plazas ·{" "}
                  {formatDateShort(vacancy.openedAt)}
                </p>
                <VacancyActions
                  vacancy={vacancy}
                  pending={statusMutation.isPending}
                  onStatus={(status) =>
                    statusMutation.mutate({ id: vacancy.id, status })
                  }
                />
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
    </div>
  );
}

function VacancyRow({
  vacancy,
  pending,
  onStatus,
}: {
  vacancy: Vacancy;
  pending: boolean;
  onStatus: (status: VacancyStatus) => void;
}) {
  return (
    <TableRow>
      <TableCell className="font-medium">{vacancy.title}</TableCell>
      <TableCell>{vacancy.position?.name ?? "—"}</TableCell>
      <TableCell>{vacancy.area?.name ?? "—"}</TableCell>
      <TableCell>{vacancy.headcount}</TableCell>
      <TableCell>{vacancy.filledCount}</TableCell>
      <TableCell>
        <Badge variant={vacancyStatusVariant(vacancy.status)}>
          {VACANCY_STATUS_LABELS[vacancy.status]}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={vacancy.publishedAt ? "success" : "secondary"}>
          {vacancy.publishedAt ? "Publicada" : "No publicada"}
        </Badge>
      </TableCell>
      <TableCell>{formatDateShort(vacancy.openedAt)}</TableCell>
      <TableCell className="text-right">
        <VacancyActions
          vacancy={vacancy}
          pending={pending}
          onStatus={onStatus}
          compact
        />
      </TableCell>
    </TableRow>
  );
}

function VacancyActions({
  vacancy,
  pending,
  onStatus,
  compact,
}: {
  vacancy: Vacancy;
  pending: boolean;
  onStatus: (status: VacancyStatus) => void;
  compact?: boolean;
}) {
  const actions = getVacancyStatusActions(vacancy.status);
  return (
    <div className={`flex flex-wrap gap-1 ${compact ? "justify-end" : ""}`}>
      <Button variant="ghost" size={compact ? "icon" : "sm"} asChild>
        <Link href={`/ats/vacancies/${vacancy.id}`} aria-label="Ver vacante">
          {compact ? <Eye className="size-4" /> : "Ver"}
        </Link>
      </Button>
      {actions.map((status) => (
        <Button
          key={status}
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => onStatus(status)}
        >
          {VACANCY_STATUS_ACTION_LABELS[status]}
        </Button>
      ))}
    </div>
  );
}
