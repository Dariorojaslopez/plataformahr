"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
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
import { useCompanyId } from "@/hooks/use-company-id";
import { getErrorMessage } from "@/lib/api/errors";
import { organizationApi, orgKeys } from "@/lib/api/organization";
import type { JobLevel, OrganizationEntityStatus } from "@/types/organization";

type FormState = {
  name: string;
  code: string;
  rank: string;
  status: OrganizationEntityStatus;
};

const emptyForm: FormState = {
  name: "",
  code: "",
  rank: "0",
  status: "ACTIVE",
};

export function JobLevelsPageClient() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<JobLevel | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: orgKeys.jobLevels(companyId),
    queryFn: () => organizationApi.listJobLevels(),
  });

  const sorted = useMemo(
    () => [...(query.data ?? [])].sort((a, b) => a.rank - b.rank),
    [query.data],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const rank = Number(form.rank);
      if (!Number.isInteger(rank) || rank < 0) {
        throw new Error("Rank debe ser un entero >= 0.");
      }
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        rank,
        status: form.status,
      };
      if (editing) return organizationApi.updateJobLevel(editing.id, payload);
      return organizationApi.createJobLevel(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: orgKeys.jobLevels(companyId),
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

  function openEdit(level: JobLevel) {
    setEditing(level);
    setForm({
      name: level.name,
      code: level.code ?? "",
      rank: String(level.rank),
      status: level.status,
    });
    setFormError(null);
    setOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Niveles"
        description="Niveles jerárquicos asociados a cargos."
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            Nuevo nivel
          </Button>
        }
      />

      {query.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : query.isError ? (
        <ErrorState
          description={getErrorMessage(query.error, "No se pudieron cargar los niveles.")}
          onRetry={() => void query.refetch()}
        />
      ) : !sorted.length ? (
        <EmptyState
          title="Sin niveles configurados"
          description="Define niveles para clasificar los cargos de la organización."
          action={
            <Button type="button" onClick={openCreate}>
              Nuevo nivel
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
                <TableHead>Rank</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((level) => (
                <TableRow key={level.id}>
                  <TableCell className="font-medium">{level.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {level.code ?? "—"}
                  </TableCell>
                  <TableCell>{level.rank}</TableCell>
                  <TableCell>
                    <OrgStatusBadge status={level.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(level)}
                      aria-label={`Editar ${level.name}`}
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
        title={editing ? "Editar nivel" : "Nuevo nivel"}
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
            <Label htmlFor="jl-name">Nombre *</Label>
            <Input
              id="jl-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="jl-code">Código</Label>
            <Input
              id="jl-code"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="jl-rank">Rank *</Label>
            <Input
              id="jl-rank"
              type="number"
              min={0}
              value={form.rank}
              onChange={(e) => setForm((f) => ({ ...f, rank: e.target.value }))}
              required
            />
            <p className="text-xs text-muted-foreground">
              Define el orden jerárquico del nivel dentro de la organización.
            </p>
          </div>
          <FormSelect
            id="jl-status"
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
