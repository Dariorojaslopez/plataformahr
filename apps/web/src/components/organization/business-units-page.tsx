"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { useCompanyId } from "@/hooks/use-company-id";
import { getErrorMessage } from "@/lib/api/errors";
import { organizationApi, orgKeys } from "@/lib/api/organization";
import type {
  BusinessUnit,
  OrganizationEntityStatus,
} from "@/types/organization";

type FormState = {
  name: string;
  code: string;
  description: string;
  status: OrganizationEntityStatus;
};

const emptyForm: FormState = {
  name: "",
  code: "",
  description: "",
  status: "ACTIVE",
};

export function BusinessUnitsPageClient() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessUnit | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: orgKeys.businessUnits(companyId),
    queryFn: () => organizationApi.listBusinessUnits(),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        status: form.status,
      };
      if (editing) {
        return organizationApi.updateBusinessUnit(editing.id, payload);
      }
      return organizationApi.createBusinessUnit(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: orgKeys.businessUnits(companyId),
      });
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      setFormError(null);
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, "No se pudo guardar."));
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setOpen(true);
  }

  function openEdit(unit: BusinessUnit) {
    setEditing(unit);
    setForm({
      name: unit.name,
      code: unit.code ?? "",
      description: unit.description ?? "",
      status: unit.status,
    });
    setFormError(null);
    setOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Unidades de negocio"
        description="Agrupaciones organizacionales de primer nivel."
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            Nueva unidad
          </Button>
        }
      />

      {query.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : query.isError ? (
        <ErrorState
          description={getErrorMessage(query.error, "No se pudieron cargar las unidades.")}
          onRetry={() => void query.refetch()}
        />
      ) : !query.data?.length ? (
        <EmptyState
          title="Sin unidades de negocio"
          description="Crea la primera unidad para organizar áreas y equipos."
          action={
            <Button type="button" onClick={openCreate}>
              Nueva unidad
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.map((unit) => (
                <TableRow key={unit.id}>
                  <TableCell className="font-medium">{unit.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {unit.code ?? "—"}
                  </TableCell>
                  <TableCell>
                    <OrgStatusBadge status={unit.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(unit)}
                      aria-label={`Editar ${unit.name}`}
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
      )}

      <EntityEditorShell
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Editar unidad" : "Nueva unidad"}
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
            <Label htmlFor="bu-name">Nombre *</Label>
            <Input
              id="bu-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bu-desc">Descripción</Label>
            <Textarea
              id="bu-desc"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </div>
          <FormSelect
            id="bu-status"
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
