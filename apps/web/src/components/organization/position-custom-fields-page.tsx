"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { EntityEditorShell } from "@/components/organization/entity-editor-shell";
import { FormSelect } from "@/components/organization/form-select";
import { slugFromLabel, typeLabel, appliesToLabel } from "@/components/organization/position-custom-fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type {
  PositionCustomFieldDefinition,
  PositionCustomFieldType,
  CustomFieldAppliesTo,
} from "@/types/organization";

type OptionDraft = { id?: string; label: string; active: boolean };

type FormState = {
  key: string;
  label: string;
  type: PositionCustomFieldType;
  appliesTo: CustomFieldAppliesTo;
  required: boolean;
  active: boolean;
  options: OptionDraft[];
};

const emptyForm: FormState = {
  key: "",
  label: "",
  type: "TEXT",
  appliesTo: "POSITION",
  required: false,
  active: true,
  options: [{ label: "", active: true }],
};

export function PositionCustomFieldsPageClient() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PositionCustomFieldDefinition | null>(
    null,
  );
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: orgKeys.positionCustomFields(companyId),
    queryFn: () => organizationApi.listPositionCustomFields(),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const label = form.label.trim();
      if (!label) throw new Error("El nombre es obligatorio.");
      const options =
        form.type === "SELECT"
          ? form.options
              .map((option, index) => ({
                ...(option.id ? { id: option.id } : {}),
                label: option.label.trim(),
                sortOrder: index,
                active: option.active,
              }))
              .filter((option) => option.label.length > 0 || option.id)
          : undefined;
      if (form.type === "SELECT" && !(options ?? []).some((option) => option.active && option.label)) {
        throw new Error("Una lista necesita al menos una opción activa.");
      }
      if (editing) {
        return organizationApi.updatePositionCustomField(editing.id, {
          label,
          required: form.required,
          active: form.active,
          ...(editing._count?.values ? {} : { type: form.type }),
          ...(form.type === "SELECT" ? { options } : {}),
        });
      }
      const key = (form.key.trim() || slugFromLabel(label)).toLowerCase();
      if (!key) throw new Error("La clave es obligatoria.");
      return organizationApi.createPositionCustomField({
        key,
        label,
        type: form.type,
        appliesTo: form.appliesTo,
        required: form.required,
        active: form.active,
        options:
          form.type === "SELECT"
            ? (options ?? [])
                .filter((option) => option.active && option.label)
                .map(({ label: optionLabel, sortOrder }) => ({
                  label: optionLabel,
                  sortOrder,
                }))
            : undefined,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: orgKeys.positionCustomFields(companyId),
      });
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      setFormError(null);
    },
    onError: (error) => {
      setFormError(
        getErrorMessage(error, "No se pudo guardar el campo personalizado."),
      );
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (definition: PositionCustomFieldDefinition) =>
      organizationApi.updatePositionCustomField(definition.id, {
        active: !definition.active,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: orgKeys.positionCustomFields(companyId),
      });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({
      definition,
      sortOrder,
    }: {
      definition: PositionCustomFieldDefinition;
      sortOrder: number;
    }) =>
      organizationApi.updatePositionCustomField(definition.id, { sortOrder }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: orgKeys.positionCustomFields(companyId),
      });
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setOpen(true);
  }

  function openEdit(definition: PositionCustomFieldDefinition) {
    setEditing(definition);
    setForm({
      key: definition.key,
      label: definition.label,
      type: definition.type,
      appliesTo: definition.appliesTo,
      required: definition.required,
      active: definition.active,
      options:
        definition.options.length > 0
          ? definition.options
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((option) => ({
                id: option.id,
                label: option.label,
                active: option.active,
              }))
          : [{ label: "", active: true }],
    });
    setFormError(null);
    setOpen(true);
  }

  const typeLocked = Boolean(editing && (editing._count?.values ?? 0) > 0);

  return (
    <div>
      <PageHeader
        title="Campos personalizados"
        description="Define campos adicionales para descripciones de cargo o personas. Cada campo aparece solo en el formulario que elijas."
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            Nuevo campo
          </Button>
        }
      />

      {query.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : query.isError ? (
        <ErrorState
          description={getErrorMessage(
            query.error,
            "No se pudieron cargar los campos personalizados.",
          )}
          onRetry={() => void query.refetch()}
        />
      ) : !(query.data?.length ?? 0) ? (
        <EmptyState
          title="Sin campos personalizados"
          description="Crea campos como centro de costo o talla de uniforme. Tú eliges el nombre, el tipo y si aparecen en descripciones de cargo o en personas."
          action={
            <Button type="button" onClick={openCreate}>
              Nuevo campo
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campo</TableHead>
                <TableHead>Dónde aparece</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Obligatorio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(query.data ?? []).map((definition, index) => (
                <TableRow key={definition.id}>
                  <TableCell className="font-medium">{definition.label}</TableCell>
                  <TableCell>{appliesToLabel(definition.appliesTo)}</TableCell>
                  <TableCell>{typeLabel(definition.type)}</TableCell>
                  <TableCell>{definition.required ? "Sí" : "No"}</TableCell>
                  <TableCell>{definition.active ? "Activo" : "Inactivo"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Subir ${definition.label}`}
                      disabled={index === 0}
                      onClick={() => {
                        const previous = (query.data ?? [])[index - 1];
                        if (!previous) return;
                        void reorderMutation.mutateAsync({
                          definition,
                          sortOrder: previous.sortOrder,
                        });
                        void reorderMutation.mutateAsync({
                          definition: previous,
                          sortOrder: definition.sortOrder,
                        });
                      }}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Bajar ${definition.label}`}
                      disabled={index === (query.data ?? []).length - 1}
                      onClick={() => {
                        const next = (query.data ?? [])[index + 1];
                        if (!next) return;
                        void reorderMutation.mutateAsync({
                          definition,
                          sortOrder: next.sortOrder,
                        });
                        void reorderMutation.mutateAsync({
                          definition: next,
                          sortOrder: definition.sortOrder,
                        });
                      }}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(definition)}
                    >
                      <Pencil className="h-4 w-4" />
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleMutation.mutate(definition)}
                    >
                      {definition.active ? "Desactivar" : "Activar"}
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
        title={editing ? "Editar campo" : "Nuevo campo"}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            saveMutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="pcf-label">Nombre *</Label>
            <Input
              id="pcf-label"
              value={form.label}
              onChange={(event) => {
                const label = event.target.value;
                setForm((current) => ({
                  ...current,
                  label,
                  key: editing ? current.key : slugFromLabel(label),
                }));
              }}
              required
            />
          </div>
          <FormSelect
            id="pcf-applies-to"
            label="Dónde aparece"
            value={form.appliesTo}
            disabled={Boolean(editing)}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                appliesTo: value as CustomFieldAppliesTo,
              }))
            }
            options={[
              {
                value: "POSITION",
                label: "Formulario de descripciones de cargo",
              },
              { value: "EMPLOYEE", label: "Formulario de personas" },
            ]}
            hint={
              editing
                ? "El destino no se puede cambiar después de crear el campo."
                : "Elige el formulario en el que las personas verán este campo."
            }
          />
          <FormSelect
            id="pcf-type"
            label="Tipo"
            value={form.type}
            disabled={typeLocked}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                type: value as PositionCustomFieldType,
              }))
            }
            options={[
              { value: "TEXT", label: "Texto" },
              { value: "NUMBER", label: "Número" },
              { value: "BOOLEAN", label: "Sí/No" },
              { value: "DATE", label: "Fecha" },
              { value: "SELECT", label: "Lista" },
            ]}
            hint={
              typeLocked
                ? "El tipo no se puede cambiar porque ya hay valores guardados."
                : undefined
            }
          />
          <label htmlFor="pcf-required" className="flex items-center gap-3">
            <Checkbox
              id="pcf-required"
              checked={form.required}
              onCheckedChange={(checked) =>
                setForm((current) => ({ ...current, required: checked === true }))
              }
            />
            <span className="text-sm">
              Obligatorio al crear o editar un{" "}
              {form.appliesTo === "EMPLOYEE" ? "persona" : "cargo"}
            </span>
          </label>
          <label htmlFor="pcf-active" className="flex items-center gap-3">
            <Checkbox
              id="pcf-active"
              checked={form.active}
              onCheckedChange={(checked) =>
                setForm((current) => ({ ...current, active: checked === true }))
              }
            />
            <span className="text-sm">Activo</span>
          </label>
          {form.type === "SELECT" ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Opciones</legend>
              {form.options.map((option, index) => (
                <div key={option.id ?? `new-${index}`} className="flex items-center gap-2">
                  <Input
                    aria-label={`Opción ${index + 1}`}
                    value={option.label}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        options: current.options.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, label: event.target.value }
                            : item,
                        ),
                      }))
                    }
                  />
                  <label className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={option.active}
                      onCheckedChange={(checked) =>
                        setForm((current) => ({
                          ...current,
                          options: current.options.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, active: checked === true }
                              : item,
                          ),
                        }))
                      }
                    />
                    Activa
                  </label>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    options: [...current.options, { label: "", active: true }],
                  }))
                }
              >
                Agregar opción
              </Button>
            </fieldset>
          ) : null}
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
