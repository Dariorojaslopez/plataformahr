"use client";

import { FormSelect } from "@/components/organization/form-select";
import {
  formatCustomFieldDisplay,
  historicCustomFields,
} from "@/components/organization/position-custom-fields";
import type { CustomFieldFormValues } from "@/components/organization/position-custom-fields";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  Position,
  PositionCustomFieldDefinition,
} from "@/types/organization";

type PositionCustomFieldsFormProps = {
  definitions: PositionCustomFieldDefinition[];
  values: CustomFieldFormValues;
  onChange: (values: CustomFieldFormValues) => void;
  position?: Position | null;
};

export function PositionCustomFieldsForm({
  definitions,
  values,
  onChange,
  position,
}: PositionCustomFieldsFormProps) {
  const historic = historicCustomFields(position ?? null);

  if (definitions.length === 0 && historic.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {definitions.length > 0 ? (
        <fieldset className="space-y-4">
          <legend className="text-sm font-medium">Campos personalizados</legend>
          {definitions.map((definition) => {
            const fieldId = `pcf-${definition.id}`;
            const value = values[definition.id];
            const label = `${definition.label}${definition.required ? " *" : ""}`;

            if (definition.type === "BOOLEAN") {
              return (
                <label
                  key={definition.id}
                  htmlFor={fieldId}
                  className="flex items-center gap-3"
                >
                  <Checkbox
                    id={fieldId}
                    checked={value === true}
                    onCheckedChange={(checked) =>
                      onChange({ ...values, [definition.id]: checked === true })
                    }
                  />
                  <span className="text-sm">{label}</span>
                </label>
              );
            }

            if (definition.type === "SELECT") {
              return (
                <FormSelect
                  key={definition.id}
                  id={fieldId}
                  label={definition.label}
                  required={definition.required}
                  value={typeof value === "string" ? value : ""}
                  onChange={(next) =>
                    onChange({ ...values, [definition.id]: next })
                  }
                  allowEmpty={!definition.required}
                  emptyLabel="Seleccionar"
                  options={definition.options
                    .filter((option) => option.active)
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((option) => ({
                      value: option.id,
                      label: option.label,
                    }))}
                />
              );
            }

            return (
              <div key={definition.id} className="space-y-2">
                <Label htmlFor={fieldId}>{label}</Label>
                <Input
                  id={fieldId}
                  type={
                    definition.type === "NUMBER"
                      ? "number"
                      : definition.type === "DATE"
                        ? "date"
                        : "text"
                  }
                  value={typeof value === "string" ? value : ""}
                  onChange={(event) =>
                    onChange({ ...values, [definition.id]: event.target.value })
                  }
                  required={definition.required}
                />
              </div>
            );
          })}
        </fieldset>
      ) : null}

      {historic.length > 0 ? (
        <div className="space-y-2 rounded-md border border-border p-3">
          <p className="text-sm font-medium">Valores históricos</p>
          <dl className="space-y-1 text-sm">
            {historic.map((field) => (
              <div key={field.definitionId} className="flex gap-2">
                <dt className="text-muted-foreground">{field.label}:</dt>
                <dd>{formatCustomFieldDisplay(field)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  );
}
