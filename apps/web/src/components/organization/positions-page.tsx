"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, Pencil, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { EntityEditorShell } from "@/components/organization/entity-editor-shell";
import { FormSelect } from "@/components/organization/form-select";
import { PositionCustomFieldsForm } from "@/components/organization/position-custom-fields-form";
import {
  activeDefinitions,
  customFieldValuesFromPosition,
  emptyCustomFieldValues,
  toCustomFieldsPayload,
  type CustomFieldFormValues,
} from "@/components/organization/position-custom-fields";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCompanyId } from "@/hooks/use-company-id";
import { getErrorMessage } from "@/lib/api/errors";
import { organizationApi, orgKeys } from "@/lib/api/organization";
import type {
  OrganizationEntityStatus,
  Position,
} from "@/types/organization";

type FormState = {
  name: string;
  code: string;
  areaId: string;
  jobLevelId: string;
  parentPositionId: string;
  mission: string;
  responsibilities: string;
  requiredExperience: string;
  requiredEducation: string;
  headcount: string;
  status: OrganizationEntityStatus;
};

const emptyForm: FormState = {
  name: "",
  code: "",
  areaId: "",
  jobLevelId: "",
  parentPositionId: "",
  mission: "",
  responsibilities: "",
  requiredExperience: "",
  requiredEducation: "",
  headcount: "1",
  status: "ACTIVE",
};

export function PositionsPageClient() {
  const companyId = useCompanyId();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Position | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [customValues, setCustomValues] = useState<CustomFieldFormValues>({});
  const [formError, setFormError] = useState<string | null>(null);

  const positionsQuery = useQuery({
    queryKey: orgKeys.positions(companyId),
    queryFn: () => organizationApi.listPositions(),
  });
  const areasQuery = useQuery({
    queryKey: orgKeys.areas(companyId),
    queryFn: () => organizationApi.listAreas(),
  });
  const levelsQuery = useQuery({
    queryKey: orgKeys.jobLevels(companyId),
    queryFn: () => organizationApi.listJobLevels(),
  });
  const fieldsQuery = useQuery({
    queryKey: orgKeys.positionCustomFields(companyId),
    queryFn: () => organizationApi.listPositionCustomFields(),
  });
  const activeFields = activeDefinitions(fieldsQuery.data ?? [], "POSITION");

  const areaMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const area of areasQuery.data ?? []) map.set(area.id, area.name);
    return map;
  }, [areasQuery.data]);

  const levelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const level of levelsQuery.data ?? []) map.set(level.id, level.name);
    return map;
  }, [levelsQuery.data]);

  const positionMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const position of positionsQuery.data ?? []) {
      map.set(position.id, position.name);
    }
    return map;
  }, [positionsQuery.data]);

  const parentOptions = useMemo(() => {
    return (positionsQuery.data ?? [])
      .filter((position) => position.id !== editing?.id)
      .filter(
        (position) =>
          position.status === "ACTIVE" ||
          position.id === editing?.parentPositionId,
      )
      .map((position) => ({
        value: position.id,
        label: position.name,
      }));
  }, [positionsQuery.data, editing?.id]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const headcount = Number(form.headcount);
      if (!form.areaId) throw new Error("El área es obligatoria.");
      if (!Number.isInteger(headcount) || headcount < 0) {
        throw new Error("Plazas debe ser un entero >= 0.");
      }
      const base = {
        name: form.name.trim(),
        areaId: form.areaId,
        mission: form.mission.trim() || undefined,
        responsibilities: form.responsibilities.trim() || undefined,
        requiredExperience: form.requiredExperience.trim() || undefined,
        requiredEducation: form.requiredEducation.trim() || undefined,
        headcount,
        status: form.status,
      };
      if (editing) {
        return organizationApi.updatePosition(editing.id, {
          ...base,
          jobLevelId: form.jobLevelId || null,
          parentPositionId: form.parentPositionId || null,
          customFields: toCustomFieldsPayload(activeFields, customValues),
        });
      }
      return organizationApi.createPosition({
        ...base,
        jobLevelId: form.jobLevelId || undefined,
        parentPositionId: form.parentPositionId || undefined,
        customFields: toCustomFieldsPayload(activeFields, customValues),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: orgKeys.positions(companyId),
      });
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      setCustomValues({});
      setFormError(null);
    },
    onError: (error) => {
      setFormError(getErrorMessage(error, "No se pudo guardar el cargo."));
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setCustomValues(emptyCustomFieldValues(activeFields));
    setFormError(null);
    setOpen(true);
  }

  function openEdit(position: Position) {
    setEditing(position);
    setForm({
      name: position.name,
      code: position.code ?? "",
      areaId: position.areaId,
      jobLevelId: position.jobLevelId ?? "",
      parentPositionId: position.parentPositionId ?? "",
      mission: position.mission ?? "",
      responsibilities: position.responsibilities ?? "",
      requiredExperience: position.requiredExperience ?? "",
      requiredEducation: position.requiredEducation ?? "",
      headcount: String(position.headcount),
      status: position.status,
    });
    setCustomValues(customFieldValuesFromPosition(activeFields, position));
    setFormError(null);
    setOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Descripciones de cargo"
        description="Definición de descripciones de cargo y plazas."
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            Nuevo cargo
          </Button>
        }
      />

      {positionsQuery.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : positionsQuery.isError ? (
        <ErrorState
          description={getErrorMessage(
            positionsQuery.error,
            "No se pudieron cargar los cargos.",
          )}
          onRetry={() => void positionsQuery.refetch()}
        />
      ) : !(positionsQuery.data?.length ?? 0) ? (
        <EmptyState
          title="Sin cargos configurados"
          description="Aún no hay cargos configurados."
          action={
            <Button type="button" onClick={openCreate}>
              Nuevo cargo
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cargo</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Nivel</TableHead>
                <TableHead>Reporta a</TableHead>
                <TableHead>
                  <span className="inline-flex items-center gap-1">
                    Plazas
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground"
                          aria-label="Ayuda plazas"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Cantidad de posiciones aprobadas para este cargo.
                      </TooltipContent>
                    </Tooltip>
                  </span>
                </TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(positionsQuery.data ?? []).map((position) => (
                <TableRow key={position.id}>
                  <TableCell className="font-medium">{position.name}</TableCell>
                  <TableCell>
                    {areaMap.get(position.areaId) ?? "—"}
                  </TableCell>
                  <TableCell>
                    {position.jobLevelId
                      ? (levelMap.get(position.jobLevelId) ?? "—")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {position.parentPositionId
                      ? (positionMap.get(position.parentPositionId) ?? "—")
                      : "—"}
                  </TableCell>
                  <TableCell>{position.headcount}</TableCell>
                  <TableCell>
                    <OrgStatusBadge status={position.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(position)}
                      aria-label={`Editar ${position.name}`}
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
        title={editing ? "Editar cargo" : "Nuevo cargo"}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!form.name.trim() || !form.areaId) {
              setFormError("Nombre y área son obligatorios.");
              return;
            }
            saveMutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="pos-name">Nombre *</Label>
            <Input
              id="pos-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <FormSelect
            id="pos-area"
            label="Área"
            required
            value={form.areaId}
            onChange={(value) => setForm((f) => ({ ...f, areaId: value }))}
            options={(areasQuery.data ?? []).map((area) => ({
              value: area.id,
              label: area.name,
            }))}
          />
          <FormSelect
            id="pos-level"
            label="Nivel"
            value={form.jobLevelId}
            onChange={(value) => setForm((f) => ({ ...f, jobLevelId: value }))}
            allowEmpty
            emptyLabel="Sin nivel"
            options={(levelsQuery.data ?? []).map((level) => ({
              value: level.id,
              label: `${level.name} (rank ${level.rank})`,
            }))}
          />
          <FormSelect
            id="pos-parent"
            label="Cargo al que reporta"
            value={form.parentPositionId}
            onChange={(value) =>
              setForm((f) => ({ ...f, parentPositionId: value }))
            }
            allowEmpty
            emptyLabel="Ninguno (cargo raíz)"
            hint="Si la persona no tiene jefe directo, el organigrama usa a quien ocupa este cargo."
            options={parentOptions}
          />
          <div className="space-y-2">
            <Label htmlFor="pos-headcount">Plazas</Label>
            <Input
              id="pos-headcount"
              type="number"
              min={0}
              value={form.headcount}
              onChange={(e) =>
                setForm((f) => ({ ...f, headcount: e.target.value }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Cantidad de posiciones aprobadas para este cargo.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pos-mission">Misión</Label>
            <Textarea
              id="pos-mission"
              value={form.mission}
              onChange={(e) =>
                setForm((f) => ({ ...f, mission: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pos-resp">Responsabilidades</Label>
            <Textarea
              id="pos-resp"
              value={form.responsibilities}
              onChange={(e) =>
                setForm((f) => ({ ...f, responsibilities: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pos-exp">Experiencia requerida</Label>
            <Textarea
              id="pos-exp"
              value={form.requiredExperience}
              onChange={(e) =>
                setForm((f) => ({ ...f, requiredExperience: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pos-edu">Educación requerida</Label>
            <Textarea
              id="pos-edu"
              value={form.requiredEducation}
              onChange={(e) =>
                setForm((f) => ({ ...f, requiredEducation: e.target.value }))
              }
            />
          </div>
          <FormSelect
            id="pos-status"
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
          <PositionCustomFieldsForm
            definitions={activeFields}
            values={customValues}
            onChange={setCustomValues}
            record={editing}
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
            <Button type="submit" disabled={saveMutation.isPending || fieldsQuery.isLoading}>
              {saveMutation.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      </EntityEditorShell>
    </div>
  );
}
