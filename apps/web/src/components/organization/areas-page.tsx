"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, List, Network, Pencil, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { EntityEditorShell } from "@/components/organization/entity-editor-shell";
import {
  AreaForm,
  NO_BUSINESS_UNIT_LABEL,
  areaToForm,
  businessUnitDisplayName,
  emptyAreaForm,
  toCreateAreaPayload,
  toUpdateAreaPayload,
  type AreaFormValues,
} from "@/components/organization/area-form";
import { OrgStatusBadge } from "@/components/organization/status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
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
import { useCompanyId } from "@/hooks/use-company-id";
import { getErrorMessage } from "@/lib/api/errors";
import { organizationApi, orgKeys } from "@/lib/api/organization";
import { cn } from "@/lib/utils";
import type { Area, AreaTreeNode } from "@/types/organization";

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
            {[buName(node.businessUnitId), node.code].filter(Boolean).join(" · ")}
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
  const [form, setForm] = useState<AreaFormValues>(() => emptyAreaForm());
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

  const hasBusinessUnits = (buQuery.data?.length ?? 0) > 0;

  const parentOptions = useMemo(() => {
    return (areasQuery.data ?? [])
      .filter((area) => !editing || area.id !== editing.id)
      .map((area) => ({ value: area.id, label: area.name }));
  }, [areasQuery.data, editing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        return organizationApi.updateArea(editing.id, toUpdateAreaPayload(form));
      }
      return organizationApi.createArea(toCreateAreaPayload(form));
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orgKeys.areas(companyId) }),
        queryClient.invalidateQueries({ queryKey: orgKeys.areaTree(companyId) }),
      ]);
      setOpen(false);
      setEditing(null);
      setForm(emptyAreaForm());
      setFormError(null);
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, "No se pudo guardar el área."));
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyAreaForm());
    setFormError(null);
    setOpen(true);
  }

  function openEdit(area: Area) {
    setEditing(area);
    setForm(areaToForm(area));
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
                    {hasBusinessUnits ? <TableHead>Unidad</TableHead> : null}
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
                      {hasBusinessUnits ? (
                        <TableCell>
                          {businessUnitDisplayName(area.businessUnitId, buMap) ??
                            NO_BUSINESS_UNIT_LABEL}
                        </TableCell>
                      ) : null}
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
                  buName={(id) =>
                    businessUnitDisplayName(id, buMap) ??
                    (hasBusinessUnits ? NO_BUSINESS_UNIT_LABEL : "")
                  }
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
          <AreaForm
            values={form}
            onChange={setForm}
            businessUnits={buQuery.data ?? []}
            parentOptions={parentOptions}
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
