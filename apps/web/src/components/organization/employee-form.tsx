"use client";

import { useMemo, useState } from "react";
import { NO_BUSINESS_UNIT_LABEL } from "@/components/organization/area-form";
import { FormSelect } from "@/components/organization/form-select";
import { PositionCustomFieldsForm } from "@/components/organization/position-custom-fields-form";
import type { CustomFieldFormValues } from "@/components/organization/position-custom-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  Area,
  BusinessUnit,
  CreateEmployeeInput,
  Employee,
  EmployeeStatus,
  Position,
  PositionCustomFieldDefinition,
  UpdateEmployeeInput,
} from "@/types/organization";

export type EmployeeFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  documentType: string;
  documentNumber: string;
  birthDate: string;
  country: string;
  state: string;
  city: string;
  maritalStatus: string;
  childrenCount: string;
  housingType: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  businessUnitId: string;
  areaId: string;
  positionId: string;
  status: EmployeeStatus;
  hireDate: string;
  terminationDate: string;
};

export function employeeToFormValues(employee?: Employee | null): EmployeeFormValues {
  return {
    firstName: employee?.firstName ?? "",
    lastName: employee?.lastName ?? "",
    email: employee?.email ?? "",
    phone: employee?.phone ?? "",
    documentType: employee?.documentType ?? "",
    documentNumber: employee?.documentNumber ?? "",
    birthDate: employee?.birthDate?.slice(0, 10) ?? "",
    country: employee?.country ?? "",
    state: employee?.state ?? "",
    city: employee?.city ?? "",
    maritalStatus: employee?.maritalStatus ?? "",
    childrenCount:
      employee?.childrenCount === null || employee?.childrenCount === undefined
        ? ""
        : String(employee.childrenCount),
    housingType: employee?.housingType ?? "",
    emergencyContactName: employee?.emergencyContactName ?? "",
    emergencyContactPhone: employee?.emergencyContactPhone ?? "",
    businessUnitId: employee?.businessUnitId ?? "",
    areaId: employee?.areaId ?? "",
    positionId: employee?.positionId ?? "",
    status: employee?.status ?? "ACTIVE",
    hireDate: employee?.hireDate?.slice(0, 10) ?? "",
    terminationDate: employee?.terminationDate?.slice(0, 10) ?? "",
  };
}

export function toCreatePayload(values: EmployeeFormValues): CreateEmployeeInput {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    email: values.email.trim(),
    phone: values.phone.trim() || undefined,
    documentType: values.documentType.trim() || undefined,
    documentNumber: values.documentNumber.trim() || undefined,
    birthDate: values.birthDate || undefined,
    country: values.country.trim() || undefined,
    state: values.state.trim() || undefined,
    city: values.city.trim() || undefined,
    maritalStatus: values.maritalStatus.trim() || undefined,
    childrenCount:
      values.childrenCount === "" ? undefined : Number(values.childrenCount),
    housingType: values.housingType.trim() || undefined,
    emergencyContactName: values.emergencyContactName.trim() || undefined,
    emergencyContactPhone: values.emergencyContactPhone.trim() || undefined,
    businessUnitId: values.businessUnitId || undefined,
    areaId: values.areaId,
    positionId: values.positionId,
    status: values.status,
    hireDate: values.hireDate || undefined,
    terminationDate: values.terminationDate || undefined,
  };
}

export function toUpdatePayload(values: EmployeeFormValues): UpdateEmployeeInput {
  return {
    ...toCreatePayload(values),
    businessUnitId: values.businessUnitId || null,
    birthDate: values.birthDate || null,
    documentType: values.documentType.trim() || null,
    documentNumber: values.documentNumber.trim() || null,
    hireDate: values.hireDate || null,
    terminationDate: values.terminationDate || null,
    childrenCount:
      values.childrenCount === "" ? null : Number(values.childrenCount),
  };
}

type EmployeeFormProps = {
  initial?: Employee | null;
  areas: Area[];
  positions: Position[];
  businessUnits: BusinessUnit[];
  customFieldDefinitions?: PositionCustomFieldDefinition[];
  customValues?: CustomFieldFormValues;
  onCustomValuesChange?: (values: CustomFieldFormValues) => void;
  submitting?: boolean;
  error?: string | null;
  onSubmit: (values: EmployeeFormValues) => void;
  onCancel: () => void;
};

export function EmployeeForm({
  initial,
  areas,
  positions,
  businessUnits,
  customFieldDefinitions = [],
  customValues = {},
  onCustomValuesChange,
  submitting,
  error,
  onSubmit,
  onCancel,
}: EmployeeFormProps) {
  const [values, setValues] = useState(() => employeeToFormValues(initial));
  const [localError, setLocalError] = useState<string | null>(null);

  const filteredPositions = useMemo(() => {
    if (!values.areaId) return positions;
    return positions.filter((position) => position.areaId === values.areaId);
  }, [positions, values.areaId]);

  function setField<K extends keyof EmployeeFormValues>(
    key: K,
    value: EmployeeFormValues[K],
  ) {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "areaId") {
        const stillValid = positions.some(
          (position) =>
            position.id === next.positionId && position.areaId === value,
        );
        if (!stillValid) next.positionId = "";
      }
      return next;
    });
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        setLocalError(null);
        if (
          !values.firstName.trim() ||
          !values.lastName.trim() ||
          !values.email.trim() ||
          !values.areaId ||
          !values.positionId
        ) {
          setLocalError(
            "Nombre, apellido, email, área y cargo son obligatorios.",
          );
          return;
        }
        onSubmit(values);
      }}
    >
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Datos personales</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="emp-first">Nombre *</Label>
            <Input
              id="emp-first"
              value={values.firstName}
              onChange={(e) => setField("firstName", e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emp-last">Apellido *</Label>
            <Input
              id="emp-last"
              value={values.lastName}
              onChange={(e) => setField("lastName", e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emp-doc-type">Identificación (tipo)</Label>
            <Input
              id="emp-doc-type"
              value={values.documentType}
              onChange={(e) => setField("documentType", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emp-doc-number">Identificación (número)</Label>
            <Input
              id="emp-doc-number"
              value={values.documentNumber}
              onChange={(e) => setField("documentNumber", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emp-birth">Fecha de nacimiento</Label>
            <Input
              id="emp-birth"
              type="date"
              value={values.birthDate}
              onChange={(e) => setField("birthDate", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emp-marital">Estado civil</Label>
            <Input
              id="emp-marital"
              value={values.maritalStatus}
              onChange={(e) => setField("maritalStatus", e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Datos de contacto</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="emp-email">Email *</Label>
            <Input
              id="emp-email"
              type="email"
              value={values.email}
              onChange={(e) => setField("email", e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emp-phone">Teléfono</Label>
            <Input
              id="emp-phone"
              value={values.phone}
              onChange={(e) => setField("phone", e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Ubicación</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="emp-country">País</Label>
            <Input
              id="emp-country"
              value={values.country}
              onChange={(e) => setField("country", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emp-state">Estado/Depto</Label>
            <Input
              id="emp-state"
              value={values.state}
              onChange={(e) => setField("state", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emp-city">Ciudad</Label>
            <Input
              id="emp-city"
              value={values.city}
              onChange={(e) => setField("city", e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Información familiar</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="emp-children">Hijos</Label>
            <Input
              id="emp-children"
              type="number"
              min={0}
              value={values.childrenCount}
              onChange={(e) => setField("childrenCount", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emp-housing">Tipo de vivienda</Label>
            <Input
              id="emp-housing"
              value={values.housingType}
              onChange={(e) => setField("housingType", e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Información organizacional</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {businessUnits.length > 0 ? (
            <FormSelect
              id="emp-bu"
              label="Unidad de negocio"
              value={values.businessUnitId}
              onChange={(value) => setField("businessUnitId", value)}
              allowEmpty
              emptyLabel={NO_BUSINESS_UNIT_LABEL}
              hint="Opcional. El colaborador puede pertenecer solo a un área."
              options={businessUnits.map((bu) => ({
                value: bu.id,
                label: bu.name,
              }))}
            />
          ) : null}
          <FormSelect
            id="emp-area"
            label="Área"
            required
            value={values.areaId}
            onChange={(value) => setField("areaId", value)}
            options={areas.map((area) => ({
              value: area.id,
              label: area.name,
            }))}
          />
          <FormSelect
            id="emp-position"
            label="Cargo"
            required
            value={values.positionId}
            onChange={(value) => setField("positionId", value)}
            options={filteredPositions.map((position) => ({
              value: position.id,
              label: position.name,
            }))}
          />
          <FormSelect
            id="emp-status"
            label="Estado"
            value={values.status}
            onChange={(value) => setField("status", value as EmployeeStatus)}
            options={[
              { value: "ACTIVE", label: "Activo" },
              { value: "INACTIVE", label: "Inactivo" },
              { value: "TERMINATED", label: "Terminado" },
            ]}
          />
          <div className="space-y-2">
            <Label htmlFor="emp-hire">Fecha de ingreso</Label>
            <Input
              id="emp-hire"
              type="date"
              value={values.hireDate}
              onChange={(e) => setField("hireDate", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emp-term">Fecha de terminación</Label>
            <Input
              id="emp-term"
              type="date"
              value={values.terminationDate}
              onChange={(e) => setField("terminationDate", e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Emergencia</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="emp-em-name">Contacto</Label>
            <Input
              id="emp-em-name"
              value={values.emergencyContactName}
              onChange={(e) =>
                setField("emergencyContactName", e.target.value)
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emp-em-phone">Teléfono de emergencia</Label>
            <Input
              id="emp-em-phone"
              value={values.emergencyContactPhone}
              onChange={(e) =>
                setField("emergencyContactPhone", e.target.value)
              }
            />
          </div>
        </div>
      </section>

      {onCustomValuesChange ? (
        <PositionCustomFieldsForm
          definitions={customFieldDefinitions}
          values={customValues}
          onChange={onCustomValuesChange}
          record={initial ?? null}
        />
      ) : null}

      {localError || error ? (
        <p className="text-sm text-destructive" role="alert">
          {localError ?? error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
