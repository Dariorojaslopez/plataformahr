"use client";

import { FormSelect } from "@/components/organization/form-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  COMPETENCY_SCALE_KIND_OPTIONS,
} from "@/lib/performance/scale-kind";
import {
  CURRENCY_CODE_OPTIONS,
  formatOptionsForKind,
  LIKERT_ICON_OPTIONS,
  MAX_DESCRIPTIVE_LEVELS,
} from "@/lib/performance/scale-format";
import {
  withKind,
  type ScaleFormValues,
} from "@/lib/performance/scale-form";
import type {
  CompetencyScaleFormat,
  CompetencyScaleKind,
  OrganizationEntityStatus,
} from "@/types/performance";

type ScaleFormFieldsProps = {
  values: ScaleFormValues;
  onChange: (values: ScaleFormValues) => void;
  idPrefix?: string;
};

export function ScaleFormFields({
  values,
  onChange,
  idPrefix = "scale",
}: ScaleFormFieldsProps) {
  const qualitative = values.kind === "QUALITATIVE";
  const formatOptions = formatOptionsForKind(values.kind);

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-name`}>Nombre *</Label>
        <Input
          id={`${idPrefix}-name`}
          value={values.name}
          onChange={(e) => onChange({ ...values, name: e.target.value })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-description`}>Descripción</Label>
        <Textarea
          id={`${idPrefix}-description`}
          value={values.description}
          onChange={(e) =>
            onChange({ ...values, description: e.target.value })
          }
          rows={3}
        />
      </div>
      <FormSelect
        id={`${idPrefix}-kind`}
        label="Tipo"
        required
        value={values.kind}
        onChange={(kind) =>
          onChange(withKind(values, kind as CompetencyScaleKind))
        }
        options={[...COMPETENCY_SCALE_KIND_OPTIONS]}
      />
      <FormSelect
        id={`${idPrefix}-format`}
        label={qualitative ? "Escala cualitativa" : "Escala cuantitativa"}
        required
        value={values.format}
        onChange={(format) =>
          onChange({
            ...values,
            format: format as CompetencyScaleFormat,
          })
        }
        options={formatOptions}
        hint={
          qualitative
            ? "Las competencias solo se califican con escalas cualitativas."
            : "Las escalas cuantitativas no se usan para calificar competencias."
        }
      />

      {qualitative && values.format === "NUMERIC" ? (
        <RangeFields
          idPrefix={idPrefix}
          values={values}
          onChange={onChange}
          hint="Cálculo: se lleva a %."
        />
      ) : null}

      {qualitative && values.format === "LIKERT" ? (
        <>
          <FormSelect
            id={`${idPrefix}-likert-icon`}
            label="Ícono de calificación"
            required
            value={values.likertIcon}
            onChange={(likertIcon) => onChange({ ...values, likertIcon })}
            options={[...LIKERT_ICON_OPTIONS]}
            hint="Ejemplo: estrellas."
          />
          <RangeFields
            idPrefix={idPrefix}
            values={values}
            onChange={onChange}
            hint="Cálculo: se lleva a %."
          />
        </>
      ) : null}

      {qualitative && values.format === "DESCRIPTIVE" ? (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">
            Niveles descriptivos (máximo {MAX_DESCRIPTIVE_LEVELS})
          </legend>
          <p className="text-xs text-muted-foreground">
            Cada nivel aporta el mismo peso. Con 5 textos, cada uno equivale al
            20% (100% total). Se requieren al menos dos.
          </p>
          {values.descriptiveLabels.map((label, index) => (
            <div key={index} className="space-y-2">
              <Label htmlFor={`${idPrefix}-desc-${index}`}>
                Nivel {index + 1}
              </Label>
              <Input
                id={`${idPrefix}-desc-${index}`}
                value={label}
                onChange={(e) => {
                  const descriptiveLabels = [...values.descriptiveLabels];
                  descriptiveLabels[index] = e.target.value;
                  onChange({ ...values, descriptiveLabels });
                }}
                placeholder="Texto descriptivo"
              />
            </div>
          ))}
        </fieldset>
      ) : null}

      {!qualitative && values.format === "PERCENTAGE" ? (
        <RangeFields
          idPrefix={idPrefix}
          values={values}
          onChange={onChange}
          step="0.01"
        />
      ) : null}

      {!qualitative && values.format === "CURRENCY" ? (
        <FormSelect
          id={`${idPrefix}-currency`}
          label="Moneda"
          required
          value={values.currencyCode}
          onChange={(currencyCode) => onChange({ ...values, currencyCode })}
          options={[...CURRENCY_CODE_OPTIONS]}
          hint="Campo con formato de moneda."
        />
      ) : null}

      {!qualitative && values.format === "NUMERIC" ? (
        <FormSelect
          id={`${idPrefix}-decimals`}
          label="Decimales"
          required
          value={values.decimalPlaces}
          onChange={(decimalPlaces) => onChange({ ...values, decimalPlaces })}
          options={[
            { value: "0", label: "0" },
            { value: "1", label: "1" },
            { value: "2", label: "2" },
          ]}
          hint="Formato de número (máximo 2 decimales)."
        />
      ) : null}

      <FormSelect
        id={`${idPrefix}-status`}
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
    </>
  );
}

function RangeFields({
  idPrefix,
  values,
  onChange,
  hint,
  step = "1",
}: {
  idPrefix: string;
  values: ScaleFormValues;
  onChange: (values: ScaleFormValues) => void;
  hint?: string;
  step?: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-min`}>Valor mínimo *</Label>
        <Input
          id={`${idPrefix}-min`}
          type="number"
          step={step}
          value={values.minValue}
          onChange={(e) => onChange({ ...values, minValue: e.target.value })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-max`}>Valor máximo *</Label>
        <Input
          id={`${idPrefix}-max`}
          type="number"
          step={step}
          value={values.maxValue}
          onChange={(e) => onChange({ ...values, maxValue: e.target.value })}
          required
        />
        {hint ? (
          <p className="text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}
