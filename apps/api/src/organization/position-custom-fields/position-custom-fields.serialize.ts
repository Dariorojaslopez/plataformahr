import {
  type Position,
  type PositionCustomFieldType,
  Prisma,
} from '@prisma/client';
import { formatDateOnly } from './position-custom-fields.validation';

export const POSITION_CUSTOM_FIELD_VALUE_INCLUDE = {
  definition: {
    select: {
      id: true,
      key: true,
      label: true,
      type: true,
      required: true,
      active: true,
      sortOrder: true,
    },
  },
  option: { select: { id: true, label: true, active: true } },
} as const;

export type PositionCustomFieldValueRow = {
  optionId: string | null;
  textValue: string | null;
  numberValue: Prisma.Decimal | number | null;
  booleanValue: boolean | null;
  dateValue: Date | null;
  definition: {
    id: string;
    key: string;
    label: string;
    type: PositionCustomFieldType;
    required: boolean;
    active: boolean;
    sortOrder: number;
  };
  option: { id: string; label: string; active: boolean } | null;
};

export type PositionWithCustomFieldValues = Position & {
  customFieldValues: PositionCustomFieldValueRow[];
};

export type PositionCustomFieldPublic = {
  definitionId: string;
  key: string;
  label: string;
  type: PositionCustomFieldType;
  required: boolean;
  active: boolean;
  value: string | number | boolean | null;
  optionId: string | null;
  optionLabel: string | null;
};

export type SerializedPosition = Position & {
  customFields: PositionCustomFieldPublic[];
};

function publicValue(
  row: PositionCustomFieldValueRow,
): string | number | boolean | null {
  switch (row.definition.type) {
    case 'TEXT':
      return row.textValue;
    case 'NUMBER':
      return row.numberValue == null ? null : Number(row.numberValue);
    case 'BOOLEAN':
      return row.booleanValue;
    case 'DATE':
      return row.dateValue ? formatDateOnly(row.dateValue) : null;
    case 'SELECT':
      return row.optionId;
    default:
      return null;
  }
}

export function serializeCustomFieldValue(
  row: PositionCustomFieldValueRow,
): PositionCustomFieldPublic {
  return {
    definitionId: row.definition.id,
    key: row.definition.key,
    label: row.definition.label,
    type: row.definition.type,
    required: row.definition.required,
    active: row.definition.active,
    value: publicValue(row),
    optionId: row.optionId,
    optionLabel: row.option?.label ?? null,
  };
}

export function serializePosition(
  row: PositionWithCustomFieldValues,
): SerializedPosition {
  const { customFieldValues, ...position } = row;
  const customFields = [...customFieldValues]
    .sort((a, b) => {
      if (a.definition.sortOrder !== b.definition.sortOrder) {
        return a.definition.sortOrder - b.definition.sortOrder;
      }
      return a.definition.label.localeCompare(b.definition.label);
    })
    .map(serializeCustomFieldValue);
  return { ...position, customFields };
}
