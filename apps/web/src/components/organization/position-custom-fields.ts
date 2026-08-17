import type {
  Position,
  PositionCustomFieldDefinition,
  PositionCustomFieldInput,
  PositionCustomFieldType,
  PositionCustomFieldValue,
} from "@/types/organization";

export type CustomFieldFormValues = Record<string, string | boolean>;

export function activeDefinitions(
  definitions: PositionCustomFieldDefinition[],
): PositionCustomFieldDefinition[] {
  return [...definitions]
    .filter((definition) => definition.active)
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.label.localeCompare(b.label);
    });
}

export function emptyCustomFieldValues(
  definitions: PositionCustomFieldDefinition[],
): CustomFieldFormValues {
  const values: CustomFieldFormValues = {};
  for (const definition of activeDefinitions(definitions)) {
    values[definition.id] = definition.type === "BOOLEAN" ? false : "";
  }
  return values;
}

export function customFieldValuesFromPosition(
  definitions: PositionCustomFieldDefinition[],
  position: Position | null,
): CustomFieldFormValues {
  const values = emptyCustomFieldValues(definitions);
  for (const field of position?.customFields ?? []) {
    if (!(field.definitionId in values)) continue;
    if (field.type === "BOOLEAN") {
      values[field.definitionId] = field.value === true;
    } else if (field.value == null) {
      values[field.definitionId] = "";
    } else {
      values[field.definitionId] = String(field.value);
    }
  }
  return values;
}

export function toCustomFieldsPayload(
  definitions: PositionCustomFieldDefinition[],
  values: CustomFieldFormValues,
): PositionCustomFieldInput[] {
  return activeDefinitions(definitions).map((definition) => {
    const raw = values[definition.id];
    if (definition.type === "BOOLEAN") {
      return { definitionId: definition.id, value: raw === true };
    }
    if (raw === "" || raw === undefined) {
      return { definitionId: definition.id, value: null };
    }
    if (definition.type === "NUMBER") {
      const parsed = Number(raw);
      return {
        definitionId: definition.id,
        value: Number.isFinite(parsed) ? parsed : raw,
      };
    }
    return { definitionId: definition.id, value: String(raw) };
  });
}

export function historicCustomFields(
  position: Position | null,
): PositionCustomFieldValue[] {
  return (position?.customFields ?? []).filter((field) => !field.active);
}

export function formatCustomFieldDisplay(
  field: Pick<
    PositionCustomFieldValue,
    "type" | "value" | "optionLabel"
  >,
): string {
  if (field.value === null || field.value === undefined || field.value === "") {
    return "—";
  }
  if (field.type === "BOOLEAN") {
    return field.value === true ? "Sí" : "No";
  }
  if (field.type === "SELECT") {
    return field.optionLabel ?? "—";
  }
  return String(field.value);
}

export function typeLabel(type: PositionCustomFieldType): string {
  switch (type) {
    case "TEXT":
      return "Texto";
    case "NUMBER":
      return "Número";
    case "BOOLEAN":
      return "Sí/No";
    case "DATE":
      return "Fecha";
    case "SELECT":
      return "Lista";
    default:
      return type;
  }
}

export function slugFromLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^([^a-z].*)$/, "c_$1")
    .slice(0, 63);
}
