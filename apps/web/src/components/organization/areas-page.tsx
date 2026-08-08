"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, List, Network, Pencil, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { EntityEditorShell } from "@/components/organization/entity-editor-shell";
import { FormSelect } from "@/components/organization/form-select";
import { OrgStatusBadge } from "@/components/organization/status-badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useCompanyId } from "@/hooks/use-company-id";
import { getErrorMessage } from "@/lib/api/errors";
import { organizationApi, orgKeys } from "@/lib/api/organization";
import { cn } from "@/lib/utils";
import type {
  Area,
  AreaTreeNode,
  OrganizationEntityStatus,
} from "@/types/organization";

type FormState = {
  name: string;
  code: string;
  description: string;
  businessUnitId: string;
  parentAreaId: string;
  status: OrganizationEntityStatus;
};

const emptyForm: FormState = {
  name: "",
  code: "",
  description: "",
  businessUnitId: "",
  parentAreaId: "",
  status: "ACTIVE",
};

function AreaTreeItem({
  node,
  buName,
  depth = 0,
}: {
  node: AreaTreeNode;
  buName: (id: string | null) => string;
  depth?: number;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60"
        style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="rounded p-0.5 hover:bg-muted"
            aria-label={open ? "Colapsar" : "Expandir"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="inline-block w-5" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{node.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {buName(node.businessUnitId)}
            {node.code ? ` · ${node.code}` : ""}
          </p>
        </div>
        <OrgStatusBadge status={node.status} />
      </div>
      {hasChildren && open ? (
        <div className={cn("border-l border-border/70 ml-4")}>
          {node.children.map((child) => (
            <AreaTreeItem
              key={child.id}
              node={child}
              buName={buName}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AreasPageClient() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Area | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const areasQuery = useQuery({
    queryKey: orgKeys.areas(companyId),
    queryFn: () => organizationApi.listAreas(),
  });
  const treeQuery = useQuery({
    queryKey: orgKeys.areaTree(companyId),
    queryFn: () => organizationApi.getAreaTree(),
  });
  const buQuery = useQuery({
    queryKey: orgKeys.businessUnits(companyId),
    queryFn: () => organizationApi.listBusinessUnits(),
  });

  const buMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const bu of buQuery.data ?? []) map.set(bu.id, bu.name);
    return map;
  }, [buQuery.data]);

  const parentOptions = useMemo(() => {
    return (areasQuery.data ?? [])
      .filter((area) => !editing || area.id !== editing.id)
      .map((area) => ({ value: area.id, label: area.name }));
  }, [areasQuery.data, editing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        description: form.description.trim() || undefined,
        businessUnitId: form.businessUnitId || undefined,
        parentAreaId: form.parentAreaId || undefined,
        status: form.status,
      };
      if (editing) {
        return organizationApi.updateArea(editing.id, {
          ...payload,
          businessUnitId: form.businessUnitId || null,
          parentAreaId: form.parentAreaId || null,
        });
      }
      return organizationApi.createArea(payload);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orgKeys.areas(companyId) }),
        queryClient.invalidateQueries({ queryKey: orgKeys.areaTree(companyId) }),
      ]);
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      setFormError(null);
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, "No se pudo guardar el área."));
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setOpen(true);
  }

  function openEdit(area: Area) {
    setEditing(area);
    setForm({
      name: area.name,
      code: area.code ?? "",
      description: area.description ?? "",
      businessUnitId: area.businessUnitId ?? "",
      parentAreaId: area.parentAreaId ?? "",
      status: area.status,
    });
    setFormError(null);
    setOpen(true);
  }

  const loading = areasQuery.isLoading || treeQuery.isLoading;

  return (
    <div>
      <PageHeader
        title="Áreas"
        description="Estructura jerárquica de la organización."
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            Nueva área
          </Button>
        }
      />

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : areasQuery.isError || treeQuery.isError ? (
        <ErrorState
          description={getErrorMessage(
            areasQuery.error ?? treeQuery.error,
            "No se pudieron cargar las áreas.",
          )}
          onRetry={() => {
            void areasQuery.refetch();
            void treeQuery.refetch();
          }}
        />
      ) : !(areasQuery.data?.length ?? 0) ? (
        <EmptyState
          title="Sin áreas"
          description="Crea la estructura organizacional comenzando por un área."
          action={
            <Button type="button" onClick={openCreate}>
              Nueva área
            </Button>
          }
        />
      ) : (
        <Tabs defaultValue="list">
          <TabsList>
            <TabsTrigger value="list" className="gap-2">
              <List className="h-4 w-4" aria-hidden />
              Lista
            </TabsTrigger>
            <TabsTrigger value="tree" className="gap-2">
              <Network className="h-4 w-4" aria-hidden />
              Jerarquía
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list">
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(areasQuery.data ?? []).map((area) => (
                    <TableRow key={area.id}>
                      <TableCell className="font-medium">{area.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {area.code ?? "—"}
                      </TableCell>
                      <TableCell>
                        {area.businessUnitId
                          ? (buMap.get(area.businessUnitId) ?? "—")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <OrgStatusBadge status={area.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(area)}
                          aria-label={`Editar ${area.name}`}
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
          </TabsContent>

          <TabsContent value="tree">
            <div className="rounded-lg border border-border bg-card p-3">
              {(treeQuery.data ?? []).map((node) => (
                <AreaTreeItem
                  key={node.id}
                  node={node}
                  buName={(id) => (id ? (buMap.get(id) ?? "—") : "Sin unidad")}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}

      <EntityEditorShell
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Editar área" : "Nueva área"}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!form.name.trim()) {
              setFormError("El nombre es obligatorio.");
              return;
            }
            saveMutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="area-name">Nombre *</Label>
            <Input
              id="area-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="area-code">Código</Label>
            <Input
              id="area-code"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="area-desc">Descripción</Label>
            <Textarea
              id="area-desc"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </div>
          <FormSelect
            id="area-bu"
            label="Unidad de negocio"
            value={form.businessUnitId}
            onChange={(value) =>
              setForm((f) => ({ ...f, businessUnitId: value }))
            }
            allowEmpty
            emptyLabel="Sin unidad"
            options={(buQuery.data ?? []).map((bu) => ({
              value: bu.id,
              label: bu.name,
            }))}
          />
          <FormSelect
            id="area-parent"
            label="Área padre"
            value={form.parentAreaId}
            onChange={(value) =>
              setForm((f) => ({ ...f, parentAreaId: value }))
            }
            allowEmpty
            emptyLabel="Sin padre (raíz)"
            options={parentOptions}
          />
          <FormSelect
            id="area-status"
            label="Estado"
            value={form.status}
            onChange={(value) =>
              setForm((f) => ({
                ...f,
                status: value as OrganizationEntityStatus,
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
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
