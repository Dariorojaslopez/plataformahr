"use client";

import { FormSelect } from "@/components/organization/form-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  Area,
  CreateAreaInput,
  OrganizationEntityStatus,
  UpdateAreaInput,
} from "@/types/organization";

export const NO_BUSINESS_UNIT_LABEL = "Sin unidad de negocio";

export type AreaFormValues = {
  name: string;
  code: string;
  description: string;
  businessUnitId: string;
  parentAreaId: string;
  status: OrganizationEntityStatus;
};

export const emptyAreaForm = (): AreaFormValues => ({
  name: "",
  code: "",
  description: "",
  businessUnitId: "",
  parentAreaId: "",
  status: "ACTIVE",
});

export function areaToForm(area: Area): AreaFormValues {
  return {
    name: area.name,
    code: area.code ?? "",
    description: area.description ?? "",
    businessUnitId: area.businessUnitId ?? "",
    parentAreaId: area.parentAreaId ?? "",
    status: area.status,
  };
}

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function toCreateAreaPayload(values: AreaFormValues): CreateAreaInput {
  return {
    name: values.name.trim(),
    code: optional(values.code),
    description: optional(values.description),
    businessUnitId: values.businessUnitId || undefined,
    parentAreaId: values.parentAreaId || undefined,
    status: values.status,
  };
}

export function toUpdateAreaPayload(values: AreaFormValues): UpdateAreaInput {
  const base = toCreateAreaPayload(values);
  return {
    ...base,
    businessUnitId: values.businessUnitId || null,
    parentAreaId: values.parentAreaId || null,
  };
}

export function businessUnitDisplayName(
  businessUnitId: string | null,
  names: Map<string, string>,
): string | null {
  if (!businessUnitId) return null;
  return names.get(businessUnitId) ?? null;
}

type AreaFormProps = {
  values: AreaFormValues;
  onChange: (values: AreaFormValues) => void;
  businessUnits: Array<{ id: string; name: string }>;
  parentOptions: Array<{ value: string; label: string }>;
};

export function AreaForm({
  values,
  onChange,
  businessUnits,
  parentOptions,
}: AreaFormProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="area-name">Nombre *</Label>
        <Input
          id="area-name"
          value={values.name}
          onChange={(e) => onChange({ ...values, name: e.target.value })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="area-code">Código</Label>
        <Input
          id="area-code"
          value={values.code}
          onChange={(e) => onChange({ ...values, code: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="area-desc">Descripción</Label>
        <Textarea
          id="area-desc"
          value={values.description}
          onChange={(e) =>
            onChange({ ...values, description: e.target.value })
          }
        />
      </div>
      <FormSelect
        id="area-bu"
        label="Unidad de negocio"
        value={values.businessUnitId}
        onChange={(businessUnitId) => onChange({ ...values, businessUnitId })}
        allowEmpty
        emptyLabel={NO_BUSINESS_UNIT_LABEL}
        hint="Opcional. La compañía puede organizar áreas sin unidades de negocio."
        options={businessUnits.map((bu) => ({
          value: bu.id,
          label: bu.name,
        }))}
      />
      <FormSelect
        id="area-parent"
        label="Área padre"
        value={values.parentAreaId}
        onChange={(parentAreaId) => onChange({ ...values, parentAreaId })}
        allowEmpty
        emptyLabel="Sin padre (raíz)"
        options={parentOptions}
      />
      <FormSelect
        id="area-status"
        label="Estado"
        value={values.status}
        onChange={(status) =>
          onChange({
            ...values,
            status: status as OrganizationEntityStatus,
          })
        }
        options={[
          { value: "ACTIVE", label: "Activo" },
          { value: "INACTIVE", label: "Inactivo" },
        ]}
      />
    </div>
  );
}
