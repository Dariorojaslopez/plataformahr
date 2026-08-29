"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { EntityEditorShell } from "@/components/organization/entity-editor-shell";
import { OrgStatusBadge } from "@/components/organization/status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScaleFormFields } from "@/components/performance/scale-form-fields";
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
import { scaleTypeLabel } from "@/lib/performance/scale-format";
import {
  scaleToForm,
  toUpdateScalePayload,
  type ScaleFormValues,
} from "@/lib/performance/scale-form";
import type { CompetencyScaleLevel } from "@/types/performance";

type LevelForm = {
  value: string;
  label: string;
  description: string;
  order: string;
};

const emptyLevelForm = (order = 0): LevelForm => ({
  value: "",
  label: "",
  description: "",
  order: String(order),
});

export function ScaleDetailPageClient() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const params = useParams<{ id: string }>();
  const scaleId = params.id;

  const [scaleOpen, setScaleOpen] = useState(false);
  const [scaleForm, setScaleForm] = useState<ScaleFormValues | null>(null);
  const [scaleError, setScaleError] = useState<string | null>(null);

  const [levelOpen, setLevelOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<CompetencyScaleLevel | null>(
    null,
  );
  const [levelForm, setLevelForm] = useState<LevelForm>(emptyLevelForm());
  const [levelError, setLevelError] = useState<string | null>(null);

  const scaleQuery = useQuery({
    queryKey: performanceKeys.scale(companyId, scaleId),
    queryFn: () => performanceApi.getScale(scaleId),
  });

  const scale = scaleQuery.data;
  const levels = useMemo(
    () =>
      [...(scale?.levels ?? [])].sort((a, b) => a.order - b.order),
    [scale?.levels],
  );

  async function invalidate() {
    await queryClient.invalidateQueries({
      queryKey: performanceKeys.scale(companyId, scaleId),
    });
    await queryClient.invalidateQueries({
      queryKey: performanceKeys.scales(companyId),
    });
  }

  const scaleMutation = useMutation({
    mutationFn: async () => {
      if (!scaleForm) throw new Error("Formulario incompleto.");
      if (!scaleForm.name.trim()) {
        throw new Error("El nombre es obligatorio.");
      }
      return performanceApi.updateScale(
        scaleId,
        toUpdateScalePayload(scaleForm),
      );
    },
    onSuccess: async () => {
      await invalidate();
      setScaleOpen(false);
      setScaleError(null);
      notifySuccess("Escala actualizada");
    },
    onError: (error) => {
      setScaleError(getErrorMessage(error, "No se pudo actualizar."));
      notifyError(error, "No se pudo actualizar.");
    },
  });

  const levelMutation = useMutation({
    mutationFn: async () => {
      if (!levelForm.label.trim()) {
        throw new Error("La etiqueta es obligatoria.");
      }
      const value = Number(levelForm.value);
      const order = Number(levelForm.order);
      if (!Number.isInteger(value) || value < 0) {
        throw new Error("El valor debe ser un entero >= 0.");
      }
      if (!Number.isInteger(order) || order < 0) {
        throw new Error("El orden debe ser un entero >= 0.");
      }

      if (editingLevel) {
        return performanceApi.updateScaleLevel(scaleId, editingLevel.id, {
          value,
          label: levelForm.label.trim(),
          description: levelForm.description.trim() || null,
          order,
        });
      }
      return performanceApi.addScaleLevel(scaleId, {
        value,
        label: levelForm.label.trim(),
        description: levelForm.description.trim() || undefined,
        order,
      });
    },
    onSuccess: async () => {
      await invalidate();
      setLevelOpen(false);
      setEditingLevel(null);
      setLevelForm(emptyLevelForm());
      setLevelError(null);
      notifySuccess(editingLevel ? "Nivel actualizado" : "Nivel agregado");
    },
    onError: (error) => {
      setLevelError(getErrorMessage(error, "No se pudo guardar el nivel."));
      notifyError(error, "No se pudo guardar el nivel.");
    },
  });

  const removeLevelMutation = useMutation({
    mutationFn: (levelId: string) =>
      performanceApi.removeScaleLevel(scaleId, levelId),
    onSuccess: async () => {
      await invalidate();
      notifySuccess("Nivel eliminado");
    },
    onError: (error) => notifyError(error, "No se pudo eliminar el nivel."),
  });

  function openScaleEdit() {
    if (!scale) return;
    setScaleForm(scaleToForm(scale));
    setScaleError(null);
    setScaleOpen(true);
  }

  function openAddLevel() {
    const nextOrder =
      levels.length === 0 ? 0 : Math.max(...levels.map((l) => l.order)) + 1;
    setEditingLevel(null);
    setLevelForm(emptyLevelForm(nextOrder));
    setLevelError(null);
    setLevelOpen(true);
  }

  function openEditLevel(level: CompetencyScaleLevel) {
    setEditingLevel(level);
    setLevelForm({
      value: String(level.value),
      label: level.label,
      description: level.description ?? "",
      order: String(level.order),
    });
    setLevelError(null);
    setLevelOpen(true);
  }

  if (scaleQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (scaleQuery.isError || !scale) {
    return (
      <ErrorState
        title="No se pudo cargar la escala"
        description={getErrorMessage(scaleQuery.error, "Error al cargar.")}
        onRetry={() => void scaleQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
          <Link href="/organization/scales">
            <ArrowLeft className="h-4 w-4" />
            Volver a escalas de calificación
          </Link>
        </Button>
        <PageHeader
          title={scale.name}
          description={scale.description ?? "Detalle de la escala."}
          actions={
            <div className="flex flex-wrap gap-2">
              <OrgStatusBadge status={scale.status} />
              <span className="text-sm text-muted-foreground">
                {scaleTypeLabel(scale.kind, scale.format)}
              </span>
              <Button type="button" variant="outline" onClick={openScaleEdit}>
                <Pencil className="h-4 w-4" />
                Editar escala
              </Button>
              {scale.kind !== "QUANTITATIVE" ? (
                <Button type="button" onClick={openAddLevel}>
                  <Plus className="h-4 w-4" />
                  Agregar nivel
                </Button>
              ) : null}
            </div>
          }
        />
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Niveles</h2>
          <p className="text-sm text-muted-foreground">
            {scale.kind === "QUANTITATIVE"
              ? "Las escalas cuantitativas no usan niveles discretos; el valor se captura con el formato configurado."
              : "Define los valores y etiquetas de la escala. Se recomienda al menos dos niveles para usarla en ciclos activos."}
          </p>
        </div>

        {levels.length === 0 ? (
          <EmptyState
            title="Sin niveles"
            description={
              scale.kind === "QUANTITATIVE"
                ? "Esta escala no requiere niveles."
                : "Agrega niveles para completar la escala."
            }
            action={
              scale.kind === "QUANTITATIVE" ? undefined : (
                <Button type="button" onClick={openAddLevel}>
                  Agregar nivel
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Orden</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Etiqueta</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {levels.map((level) => (
                    <TableRow key={level.id}>
                      <TableCell>{level.order}</TableCell>
                      <TableCell>{level.value}</TableCell>
                      <TableCell className="font-medium">
                        {level.label}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {level.description ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditLevel(level)}
                          >
                            <Pencil className="h-4 w-4" />
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={removeLevelMutation.isPending}
                            onClick={() =>
                              removeLevelMutation.mutate(level.id)
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                            Eliminar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-3 md:hidden">
              {levels.map((level) => (
                <div
                  key={level.id}
                  className="space-y-2 rounded-lg border border-border bg-card p-4"
                >
                  <p className="font-medium">
                    {level.label}{" "}
                    <span className="text-muted-foreground">
                      (valor {level.value})
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Orden {level.order}
                    {level.description ? ` · ${level.description}` : ""}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openEditLevel(level)}
                    >
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={removeLevelMutation.isPending}
                      onClick={() => removeLevelMutation.mutate(level.id)}
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <EntityEditorShell
        open={scaleOpen}
        onOpenChange={setScaleOpen}
        title="Editar escala"
      >
        {scaleForm ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              scaleMutation.mutate();
            }}
          >
            <ScaleFormFields
              values={scaleForm}
              onChange={(next) => setScaleForm(next)}
              idPrefix="scale-edit"
            />
            {scaleError ? (
              <p className="text-sm text-destructive" role="alert">
                {scaleError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setScaleOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={scaleMutation.isPending}>
                {scaleMutation.isPending ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </form>
        ) : null}
      </EntityEditorShell>

      <EntityEditorShell
        open={levelOpen}
        onOpenChange={setLevelOpen}
        title={editingLevel ? "Editar nivel" : "Nuevo nivel"}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            levelMutation.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="level-value">Valor *</Label>
              <Input
                id="level-value"
                type="number"
                min={0}
                value={levelForm.value}
                onChange={(e) =>
                  setLevelForm((f) => ({ ...f, value: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="level-order">Orden *</Label>
              <Input
                id="level-order"
                type="number"
                min={0}
                value={levelForm.order}
                onChange={(e) =>
                  setLevelForm((f) => ({ ...f, order: e.target.value }))
                }
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="level-label">Etiqueta *</Label>
            <Input
              id="level-label"
              value={levelForm.label}
              onChange={(e) =>
                setLevelForm((f) => ({ ...f, label: e.target.value }))
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="level-description">Descripción</Label>
            <Textarea
              id="level-description"
              value={levelForm.description}
              onChange={(e) =>
                setLevelForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={3}
            />
          </div>
          {levelError ? (
            <p className="text-sm text-destructive" role="alert">
              {levelError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLevelOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={levelMutation.isPending}>
              {levelMutation.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      </EntityEditorShell>
    </div>
  );
}
