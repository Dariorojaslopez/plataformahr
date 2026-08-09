"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search } from "lucide-react";
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
  Competency,
  ListCompetenciesParams,
  OrganizationEntityStatus,
} from "@/types/performance";

type FormState = {
  name: string;
  code: string;
  description: string;
  status: OrganizationEntityStatus;
  defaultScaleId: string;
};

const emptyForm = (): FormState => ({
  name: "",
  code: "",
  description: "",
  status: "ACTIVE",
  defaultScaleId: "",
});

function useCompetencyFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const params: ListCompetenciesParams = {
    search: searchParams.get("search") ?? undefined,
    status:
      (searchParams.get("status") as OrganizationEntityStatus | null) ??
      undefined,
    page: Number(searchParams.get("page") ?? "1") || 1,
    limit: 20,
  };

  function setParams(next: Partial<ListCompetenciesParams>) {
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

export function CompetenciesPageClient() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const { params, setParams } = useCompetencyFilters();
  const [searchInput, setSearchInput] = useState(params.search ?? "");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Competency | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: performanceKeys.competencies(companyId, params),
    queryFn: () => performanceApi.listCompetencies(params),
  });

  const scalesQuery = useQuery({
    queryKey: performanceKeys.scales(companyId, { status: "ACTIVE", limit: 100 }),
    queryFn: () =>
      performanceApi.listScales({ status: "ACTIVE", limit: 100 }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) {
        throw new Error("El nombre es obligatorio.");
      }
      if (editing) {
        return performanceApi.updateCompetency(editing.id, {
          name: form.name.trim(),
          code: form.code.trim() || null,
          description: form.description.trim() || null,
          status: form.status,
          defaultScaleId: form.defaultScaleId || null,
        });
      }
      return performanceApi.createCompetency({
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        description: form.description.trim() || undefined,
        status: form.status,
        defaultScaleId: form.defaultScaleId || undefined,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: performanceKeys.all(companyId),
      });
      setOpen(false);
      setEditing(null);
      setForm(emptyForm());
      setFormError(null);
      notifySuccess(
        editing ? "Competencia actualizada" : "Competencia creada",
      );
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, "No se pudo guardar."));
      notifyError(error, "No se pudo guardar.");
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setOpen(true);
  }

  function openEdit(item: Competency) {
    setEditing(item);
    setForm({
      name: item.name,
      code: item.code ?? "",
      description: item.description ?? "",
      status: item.status,
      defaultScaleId: item.defaultScaleId ?? "",
    });
    setFormError(null);
    setOpen(true);
  }

  const items = listQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Competencias"
        description="Catálogo de competencias de desempeño."
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            Nueva competencia
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
            placeholder="Buscar competencia…"
            aria-label="Buscar competencias"
          />
          <Button type="submit" variant="secondary" aria-label="Buscar">
            <Search className="size-4" />
          </Button>
        </form>
        <FormSelect
          id="comp-status"
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
          title="No se pudieron cargar las competencias"
          description={getErrorMessage(listQuery.error, "Error al cargar.")}
          onRetry={() => void listQuery.refetch()}
        />
      ) : null}

      {listQuery.isSuccess && items.length === 0 ? (
        <EmptyState
          title="Sin competencias"
          description="Define competencias para usarlas en los ciclos."
          action={
            <Button type="button" onClick={openCreate}>
              Nueva competencia
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
                  <TableHead>Código</TableHead>
                  <TableHead>Escala por defecto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.code ?? "—"}
                    </TableCell>
                    <TableCell>
                      {item.defaultScale?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <OrgStatusBadge status={item.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(item)}
                      >
                        <Pencil className="h-4 w-4" />
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {items.map((item) => (
              <div
                key={item.id}
                className="space-y-3 rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.code ?? "Sin código"} ·{" "}
                      {item.defaultScale?.name ?? "Sin escala"}
                    </p>
                  </div>
                  <OrgStatusBadge status={item.status} />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openEdit(item)}
                >
                  Editar
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
        title={editing ? "Editar competencia" : "Nueva competencia"}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="comp-name">Nombre *</Label>
            <Input
              id="comp-name"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="comp-code">Código</Label>
            <Input
              id="comp-code"
              value={form.code}
              onChange={(e) =>
                setForm((f) => ({ ...f, code: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="comp-description">Descripción</Label>
            <Textarea
              id="comp-description"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={3}
            />
          </div>
          <FormSelect
            id="comp-form-status"
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
          <FormSelect
            id="comp-default-scale"
            label="Escala por defecto"
            value={form.defaultScaleId}
            onChange={(defaultScaleId) =>
              setForm((f) => ({ ...f, defaultScaleId }))
            }
            allowEmpty
            emptyLabel="Ninguna"
            options={(scalesQuery.data?.items ?? []).map((s) => ({
              value: s.id,
              label: s.name,
            }))}
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
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      </EntityEditorShell>
    </div>
  );
}
