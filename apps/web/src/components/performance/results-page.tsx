"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, Eye, Search } from "lucide-react";
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
import { getErrorMessage } from "@/lib/api/errors";
import { organizationApi, orgKeys } from "@/lib/api/organization";
import { performanceApi, performanceKeys } from "@/lib/api/performance";
import { snapshotDisplayName } from "@/lib/performance/analytics-view";
import { formatScorePercentage } from "@/lib/performance/response-workspace";
import {
  RESULT_STATUS_LABELS,
  resultStatusVariant,
} from "@/lib/performance/result-labels";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type {
  ListPerformanceResultsParams,
  PerformanceResultStatus,
} from "@/types/performance";

function employeeName(row: {
  firstName: string;
  lastName: string;
}): string {
  return `${row.firstName} ${row.lastName}`.trim();
}

function useResultFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const params: ListPerformanceResultsParams = {
    search: searchParams.get("search") ?? undefined,
    cycleId: searchParams.get("cycleId") ?? undefined,
    status:
      (searchParams.get("status") as PerformanceResultStatus | null) ??
      undefined,
    areaId: searchParams.get("areaId") ?? undefined,
    positionId: searchParams.get("positionId") ?? undefined,
    businessUnitId: searchParams.get("businessUnitId") ?? undefined,
    page: Number(searchParams.get("page") ?? "1") || 1,
    limit: 20,
  };

  function setParams(next: Partial<ListPerformanceResultsParams>) {
    const merged = { ...params, ...next };
    const sp = new URLSearchParams();
    if (merged.search) sp.set("search", merged.search);
    if (merged.cycleId) sp.set("cycleId", merged.cycleId);
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

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ResultsPageClient() {
  const companyId = useCompanyId();
  const { params, setParams } = useResultFilters();
  const [searchInput, setSearchInput] = useState(params.search ?? "");

  const listQuery = useQuery({
    queryKey: performanceKeys.results(companyId, params),
    queryFn: () => performanceApi.listResults(params),
  });

  const cyclesQuery = useQuery({
    queryKey: performanceKeys.cycles(companyId, { limit: 100 }),
    queryFn: () => performanceApi.listCycles({ limit: 100 }),
  });

  const areasQuery = useQuery({
    queryKey: orgKeys.areas(companyId),
    queryFn: () => organizationApi.listAreas(),
  });

  const positionsQuery = useQuery({
    queryKey: orgKeys.positions(companyId),
    queryFn: () => organizationApi.listPositions(),
  });

  const businessUnitsQuery = useQuery({
    queryKey: orgKeys.businessUnits(companyId),
    queryFn: () => organizationApi.listBusinessUnits(),
  });

  const exportMutation = useMutation({
    mutationFn: () => performanceApi.exportResultsCsv(params),
    onSuccess: ({ blob, filename }) => {
      triggerBlobDownload(
        blob,
        filename ?? "resultados-desempeno.csv",
      );
      notifySuccess("CSV exportado");
    },
    onError: (error) => notifyError(error, "No se pudo exportar el CSV."),
  });

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = listQuery.data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resultados"
        description="Resultados consolidados de desempeño por colaborador y ciclo. Los filtros de área/cargo/unidad usan el snapshot histórico."
        actions={
          <Button
            type="button"
            variant="secondary"
            disabled={exportMutation.isPending}
            onClick={() => exportMutation.mutate()}
          >
            <Download className="h-4 w-4" />
            {exportMutation.isPending ? "Exportando…" : "Exportar CSV"}
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
            placeholder="Buscar por colaborador…"
            aria-label="Buscar resultados"
          />
          <Button type="submit" variant="secondary" aria-label="Buscar">
            <Search className="size-4" />
          </Button>
        </form>
        <FormSelect
          id="result-cycle"
          label="Ciclo"
          className="w-full sm:w-56"
          value={params.cycleId ?? ""}
          onChange={(cycleId) =>
            setParams({ cycleId: cycleId || undefined, page: 1 })
          }
          allowEmpty
          emptyLabel="Todos"
          options={(cyclesQuery.data?.items ?? []).map((c) => ({
            value: c.id,
            label: c.name,
          }))}
        />
        <FormSelect
          id="result-status"
          label="Estado"
          className="w-full sm:w-48"
          value={params.status ?? ""}
          onChange={(status) =>
            setParams({
              status: (status || undefined) as
                | PerformanceResultStatus
                | undefined,
              page: 1,
            })
          }
          allowEmpty
          emptyLabel="Todos"
          options={[
            { value: "CALCULATED", label: RESULT_STATUS_LABELS.CALCULATED },
            { value: "RELEASED", label: RESULT_STATUS_LABELS.RELEASED },
          ]}
        />
        <FormSelect
          id="result-area"
          label="Área (snapshot)"
          className="w-full sm:w-48"
          value={params.areaId ?? ""}
          onChange={(areaId) =>
            setParams({ areaId: areaId || undefined, page: 1 })
          }
          allowEmpty
          emptyLabel="Todas"
          options={(areasQuery.data ?? []).map((a) => ({
            value: a.id,
            label: a.name,
          }))}
        />
        <FormSelect
          id="result-position"
          label="Cargo (snapshot)"
          className="w-full sm:w-48"
          value={params.positionId ?? ""}
          onChange={(positionId) =>
            setParams({ positionId: positionId || undefined, page: 1 })
          }
          allowEmpty
          emptyLabel="Todos"
          options={(positionsQuery.data ?? []).map((p) => ({
            value: p.id,
            label: p.name,
          }))}
        />
        <FormSelect
          id="result-bu"
          label="Unidad de negocio"
          className="w-full sm:w-48"
          value={params.businessUnitId ?? ""}
          onChange={(businessUnitId) =>
            setParams({
              businessUnitId: businessUnitId || undefined,
              page: 1,
            })
          }
          allowEmpty
          emptyLabel="Todas"
          options={(businessUnitsQuery.data ?? []).map((b) => ({
            value: b.id,
            label: b.name,
          }))}
        />
      </div>

      {listQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : null}

      {listQuery.isError ? (
        <ErrorState
          title="No se pudieron cargar los resultados"
          description={getErrorMessage(listQuery.error, "Error al cargar.")}
          onRetry={() => void listQuery.refetch()}
        />
      ) : null}

      {listQuery.isSuccess && items.length === 0 ? (
        <EmptyState
          title="Sin resultados"
          description="Cuando calcules resultados en un ciclo activo, aparecerán aquí."
        />
      ) : null}

      {items.length > 0 ? (
        <>
          <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Ciclo</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead>Overall</TableHead>
                  <TableHead>Autoeval.</TableHead>
                  <TableHead>Líder</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {employeeName(row.employee)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {row.employee.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{row.cycle.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.cycle.startDate} → {row.cycle.endDate}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {snapshotDisplayName(row.areaSnapshot, "Sin área")}
                    </TableCell>
                    <TableCell>
                      {snapshotDisplayName(row.positionSnapshot, "Sin cargo")}
                    </TableCell>
                    <TableCell>
                      {snapshotDisplayName(
                        row.businessUnitSnapshot,
                        "Sin unidad de negocio",
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatScorePercentage(row.overallScore)}
                    </TableCell>
                    <TableCell>
                      {formatScorePercentage(row.selfScore)}
                    </TableCell>
                    <TableCell>
                      {formatScorePercentage(row.managerScore)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={resultStatusVariant(row.status)}>
                        {RESULT_STATUS_LABELS[row.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button type="button" variant="ghost" size="sm" asChild>
                        <Link href={`/performance/results/${row.id}`}>
                          <Eye className="h-4 w-4" />
                          Ver
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {items.map((row) => (
              <div
                key={row.id}
                className="space-y-2 rounded-lg border border-border bg-card p-4"
              >
                <p className="font-medium">{employeeName(row.employee)}</p>
                <p className="text-sm text-muted-foreground">{row.cycle.name}</p>
                <p className="text-sm text-muted-foreground">
                  {snapshotDisplayName(row.areaSnapshot, "Sin área")} ·{" "}
                  {snapshotDisplayName(row.positionSnapshot, "Sin cargo")}
                </p>
                <p className="text-sm">
                  Overall: {formatScorePercentage(row.overallScore)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Auto: {formatScorePercentage(row.selfScore)} · Líder:{" "}
                  {formatScorePercentage(row.managerScore)}
                </p>
                <Badge variant={resultStatusVariant(row.status)}>
                  {RESULT_STATUS_LABELS[row.status]}
                </Badge>
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link href={`/performance/results/${row.id}`}>Ver detalle</Link>
                </Button>
              </div>
            ))}
          </div>

          <PaginationControls
            page={params.page ?? 1}
            totalPages={totalPages}
            total={total}
            onPageChange={(page) => setParams({ page })}
          />
        </>
      ) : null}
    </div>
  );
}
