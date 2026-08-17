"use client";

import {
  CANDIDATE_DOCUMENT_TYPES,
  isCandidateDocumentType,
} from "@talento/shared";
import { FormSelect } from "@/components/organization/form-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  Candidate,
  CandidateStatus,
  CreateCandidateInput,
  UpdateCandidateInput,
} from "@/types/ats";

export type CandidateFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  documentType: string;
  documentNumber: string;
  country: string;
  state: string;
  city: string;
  source: string;
  status: CandidateStatus | "";
};

export const emptyCandidateForm = (): CandidateFormValues => ({
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  documentType: "",
  documentNumber: "",
  country: "",
  state: "",
  city: "",
  source: "",
  status: "",
});

export function candidateToForm(candidate: Candidate): CandidateFormValues {
  return {
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    email: candidate.email,
    phone: candidate.phone ?? "",
    documentType: candidate.documentType ?? "",
    documentNumber: candidate.documentNumber ?? "",
    country: candidate.country ?? "",
    state: candidate.state ?? "",
    city: candidate.city ?? "",
    source: candidate.source ?? "",
    status: candidate.status,
  };
}

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function toCreateCandidatePayload(
  values: CandidateFormValues,
): CreateCandidateInput {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    email: values.email.trim(),
    phone: optional(values.phone),
    documentType: optional(values.documentType),
    documentNumber: optional(values.documentNumber),
    country: optional(values.country),
    state: optional(values.state),
    city: optional(values.city),
    source: optional(values.source),
  };
}

export function toUpdateCandidatePayload(
  values: CandidateFormValues,
): UpdateCandidateInput {
  const base = toCreateCandidatePayload(values);
  const payload: UpdateCandidateInput = { ...base };
  if (
    values.documentType &&
    !isCandidateDocumentType(values.documentType)
  ) {
    delete payload.documentType;
  }
  if (values.status === "ACTIVE" || values.status === "INACTIVE") {
    payload.status = values.status;
  }
  return payload;
}

type CandidateFormProps = {
  values: CandidateFormValues;
  onChange: (values: CandidateFormValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitting?: boolean;
  error?: string | null;
  allowStatus?: boolean;
  submitLabel?: string;
};

export function CandidateForm({
  values,
  onChange,
  onSubmit,
  onCancel,
  submitting,
  error,
  allowStatus,
  submitLabel = "Guardar",
}: CandidateFormProps) {
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="c-first"
          label="Nombre *"
          value={values.firstName}
          onChange={(firstName) => onChange({ ...values, firstName })}
          required
        />
        <Field
          id="c-last"
          label="Apellido *"
          value={values.lastName}
          onChange={(lastName) => onChange({ ...values, lastName })}
          required
        />
      </div>
      <Field
        id="c-email"
        label="Email *"
        type="email"
        value={values.email}
        onChange={(email) => onChange({ ...values, email })}
        required
      />
      <Field
        id="c-phone"
        label="Teléfono"
        value={values.phone}
        onChange={(phone) => onChange({ ...values, phone })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormSelect
          id="c-doc-type"
          label="Tipo documento"
          value={values.documentType}
          onChange={(documentType) => onChange({ ...values, documentType })}
          allowEmpty
          emptyLabel="Ninguno"
          options={documentTypeOptions(values.documentType)}
        />
        <Field
          id="c-doc-num"
          label="Número documento"
          value={values.documentNumber}
          onChange={(documentNumber) => onChange({ ...values, documentNumber })}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          id="c-country"
          label="País"
          value={values.country}
          onChange={(country) => onChange({ ...values, country })}
        />
        <Field
          id="c-state"
          label="Estado/Provincia"
          value={values.state}
          onChange={(state) => onChange({ ...values, state })}
        />
        <Field
          id="c-city"
          label="Ciudad"
          value={values.city}
          onChange={(city) => onChange({ ...values, city })}
        />
      </div>
      <Field
        id="c-source"
        label="Fuente"
        value={values.source}
        onChange={(source) => onChange({ ...values, source })}
      />
      {allowStatus ? (
        <FormSelect
          id="c-status"
          label="Estado"
          value={values.status}
          onChange={(status) =>
            onChange({
              ...values,
              status: status as CandidateStatus | "",
            })
          }
          options={[
            { value: "ACTIVE", label: "Activo" },
            { value: "INACTIVE", label: "Inactivo" },
          ]}
          hint="HIRED no se puede asignar desde esta pantalla."
        />
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Guardando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function documentTypeOptions(current: string): Array<{ value: string; label: string }> {
  const catalog = CANDIDATE_DOCUMENT_TYPES.map((item) => ({
    value: item.code,
    label: item.label,
  }));
  if (current && !isCandidateDocumentType(current)) {
    return [
      { value: current, label: `${current} (valor anterior)` },
      ...catalog,
    ];
  }
  return catalog;
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
