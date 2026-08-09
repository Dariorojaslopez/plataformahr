"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { EntityEditorShell } from "@/components/organization/entity-editor-shell";
import { FormSelect } from "@/components/organization/form-select";
import { OrgStatusBadge } from "@/components/organization/status-badge";
import { PaginationControls } from "@/components/organization/pagination-controls";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { useCompanyId } from "@/hooks/use-company-id";
import { getErrorMessage } from "@/lib/api/errors";
import { performanceApi, performanceKeys } from "@/lib/api/performance";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import type {
  ListScalesParams,
  OrganizationEntityStatus,
} from "@/types/performance";

type FormState = {
  name: string;
  description: string;
  status: OrganizationEntityStatus;
};

const emptyForm = (): FormState => ({
  name: "",
  description: "",
  status: "ACTIVE",
});

function useScaleFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const params: ListScalesParams = {
    search: searchParams.get("search") ?? undefined,
    status:
      (searchParams.get("status") as OrganizationEntityStatus | null) ??
      undefined,
    page: Number(searchParams.get("page") ?? "1") || 1,
    limit: 20,
  };

  function setParams(next: Partial<ListScalesParams>) {
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

export function ScalesPageClient() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const { params, setParams } = useScaleFilters();
  const [searchInput, setSearchInput] = useState(params.search ?? "");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: performanceKeys.scales(companyId, params),
    queryFn: () => performanceApi.listScales(params),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) {
        throw new Error("El nombre es obligatorio.");
      }
      return performanceApi.createScale({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        status: form.status,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: performanceKeys.all(companyId),
      });
      setOpen(false);
      setForm(emptyForm());
      setFormError(null);
      notifySuccess("Escala creada");
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, "No se pudo crear la escala."));
      notifyError(error, "No se pudo crear la escala.");
    },
  });

  const items = listQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Escalas"
        description="Escalas de valoración para competencias."
        actions={
          <Button
            type="button"
            onClick={() => {
              setForm(emptyForm());
              setFormError(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Nueva escala
          </Button>
        }
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
            placeholder="Buscar escala…"
            aria-label="Buscar escalas"
          />
          <Button type="submit" variant="secondary" aria-label="Buscar">
            <Search className="size-4" />
          </Button>
        </form>
        <FormSelect
          id="scale-status"
          label="Estado"
          className="w-full sm:w-48"
          value={params.status ?? ""}
          onChange={(status) =>
            setParams({
              status: (status || undefined) as
                | OrganizationEntityStatus
                | undefined,
              page: 1,
            })
          }
          allowEmpty
          emptyLabel="Todos"
          options={[
            { value: "ACTIVE", label: "Activo" },
            { value: "INACTIVE", label: "Inactivo" },
          ]}
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
          title="No se pudieron cargar las escalas"
          description={getErrorMessage(listQuery.error, "Error al cargar.")}
          onRetry={() => void listQuery.refetch()}
        />
      ) : null}

      {listQuery.isSuccess && items.length === 0 ? (
        <EmptyState
          title="Sin escalas"
          description="Crea una escala y define sus niveles."
          action={
            <Button
              type="button"
              onClick={() => {
                setForm(emptyForm());
                setFormError(null);
                setOpen(true);
              }}
            >
              Nueva escala
            </Button>
          }
        />
      ) : null}

      {items.length > 0 ? (
        <>
          <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Niveles</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((scale) => (
                  <TableRow key={scale.id}>
                    <TableCell className="font-medium">{scale.name}</TableCell>
                    <TableCell>{scale.levelCount ?? "—"}</TableCell>
                    <TableCell>
                      <OrgStatusBadge status={scale.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/performance/scales/${scale.id}`}>
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
            {items.map((scale) => (
              <div
                key={scale.id}
                className="space-y-3 rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{scale.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {scale.levelCount ?? 0} nivel
                      {(scale.levelCount ?? 0) === 1 ? "" : "es"}
                    </p>
                  </div>
                  <OrgStatusBadge status={scale.status} />
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/performance/scales/${scale.id}`}>Ver</Link>
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

      <EntityEditorShell
        open={open}
        onOpenChange={setOpen}
        title="Nueva escala"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="scale-name">Nombre *</Label>
            <Input
              id="scale-name"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="scale-description">Descripción</Label>
            <Textarea
              id="scale-description"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={3}
            />
          </div>
          <FormSelect
            id="scale-form-status"
            label="Estado"
            value={form.status}
            onChange={(status) =>
              setForm((f) => ({
                ...f,
                status: status as OrganizationEntityStatus,
              }))
            }
            options={[
              { value: "ACTIVE", label: "Activo" },
              { value: "INACTIVE", label: "Inactivo" },
            ]}
          />
          {formError ? (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      </EntityEditorShell>
    </div>
  );
}
