"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/components/auth/session-provider";
import { PaginationControls } from "@/components/organization/pagination-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCompanyId } from "@/hooks/use-company-id";
import { companyApi, companyKeys } from "@/lib/api/company";
import { getErrorMessage } from "@/lib/api/errors";
import { goalKeys, goalsApi } from "@/lib/api/goals";
import { GOAL_STATUS_LABELS, goalStatusVariant } from "@/lib/goals/labels";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type { GoalStatus, ListGoalsParams } from "@/types/goals";

function useFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const params: ListGoalsParams = {
    search: searchParams.get("search") ?? undefined,
    status: (searchParams.get("status") as GoalStatus | null) ?? undefined,
    page: Number(searchParams.get("page") ?? "1") || 1,
    limit: 20,
  };
  function setParams(next: Partial<ListGoalsParams>) {
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

export function GoalsPageClient() {
  const companyId = useCompanyId();
  const { companyAccess } = useSession();
  const canToggleCascade = (companyAccess?.roleCodes ?? []).includes(
    "CLIENT_ADMIN",
  );
  const { params, setParams } = useFilters();
  const [searchInput, setSearchInput] = useState(params.search ?? "");
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: goalKeys.goals(companyId, { ...params, type: "COMPANY" }),
    queryFn: () => goalsApi.listOrganizationalGoals(params),
  });
  const companyQuery = useQuery({
    queryKey: companyKeys.current(companyId),
    queryFn: () => companyApi.getCurrent(),
  });

  const cascadeMutation = useMutation({
    mutationFn: (goalsCascadeEnabled: boolean) =>
      companyApi.updatePerformanceSettings({ goalsCascadeEnabled }),
    onSuccess: async (company) => {
      queryClient.setQueryData(companyKeys.current(companyId), company);
      notifySuccess(
        company.goalsCascadeEnabled
          ? "Cascadeo activado: los objetivos de compañía aplican a todos."
          : "Cascadeo desactivado.",
      );
    },
    onError: (error) => notifyError(error, "No se pudo guardar el cascadeo."),
  });

  const items = listQuery.data?.items ?? [];
  const cascadeOn = companyQuery.data?.goalsCascadeEnabled === true;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Objetivos organizacionales"
        description="Objetivos de compañía en modo consulta para todas las personas."
      />

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Label htmlFor="cascade-switch">Cascadeo</Label>
          <p className="text-sm text-muted-foreground">
            Si está activo, estos objetivos aplican a todas las personas. Por
            defecto permanece apagado.
          </p>
        </div>
        <Switch
          id="cascade-switch"
          checked={cascadeOn}
          disabled={!canToggleCascade || cascadeMutation.isPending}
          onCheckedChange={(checked) => cascadeMutation.mutate(checked)}
          aria-label="Activar cascadeo de objetivos organizacionales"
        />
      </section>

      <form
        className="flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setParams({ search: searchInput.trim() || undefined, page: 1 });
        }}
      >
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Buscar por título…"
          aria-label="Buscar objetivos organizacionales"
        />
        <Button type="submit" variant="secondary" aria-label="Buscar">
          <Search className="size-4" />
        </Button>
      </form>

      {listQuery.isLoading ? <Skeleton className="h-24 w-full" /> : null}
      {listQuery.isError ? (
        <ErrorState
          title="No se pudieron cargar los objetivos"
          description={getErrorMessage(listQuery.error, "Error")}
          onRetry={() => void listQuery.refetch()}
        />
      ) : null}
      {listQuery.isSuccess && items.length === 0 ? (
        <EmptyState
          title="Sin objetivos organizacionales"
          description="Cuando existan objetivos de compañía, aparecerán aquí en solo lectura."
        />
      ) : null}

      {items.length > 0 ? (
        <>
          <div className="hidden overflow-hidden rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>KR</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.title}</TableCell>
                    <TableCell>{row.cycle.name}</TableCell>
                    <TableCell>
                      <Badge variant={goalStatusVariant(row.status)}>
                        {GOAL_STATUS_LABELS[row.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.keyResultCount}</TableCell>
                    <TableCell className="text-right">
                      <Button type="button" variant="ghost" size="sm" asChild>
                        <Link href={`/goals/${row.id}`}>
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
                <p className="font-medium">{row.title}</p>
                <p className="text-sm text-muted-foreground">{row.cycle.name}</p>
                <Badge variant={goalStatusVariant(row.status)}>
                  {GOAL_STATUS_LABELS[row.status]}
                </Badge>
                <Button type="button" variant="ghost" size="sm" asChild>
                  <Link href={`/goals/${row.id}`}>Ver</Link>
                </Button>
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
