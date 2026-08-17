import { BadRequestException } from '@nestjs/common';
import { PositionCustomFieldType } from '@prisma/client';

export const CUSTOM_FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{1,62}$/;
export const MAX_CUSTOM_FIELDS = 50;
export const MAX_SELECT_OPTIONS = 50;
export const MAX_TEXT_LENGTH = 2000;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export type ParsedCustomValue =
  | { kind: 'empty' }
  | { kind: 'text'; textValue: string }
  | { kind: 'number'; numberValue: number }
  | { kind: 'boolean'; booleanValue: boolean }
  | { kind: 'date'; dateValue: Date }
  | { kind: 'select'; optionId: string };

export function normalizeCustomFieldKey(raw: string): string {
  return raw.trim().toLowerCase();
}

export function assertCustomFieldKey(raw: string): string {
  const key = normalizeCustomFieldKey(raw);
  if (!CUSTOM_FIELD_KEY_PATTERN.test(key)) {
    throw new BadRequestException(
      'key must be 2–63 characters: start with a letter, then lowercase letters, digits or underscore',
    );
  }
  return key;
}

export function isEmptyCustomValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
}

export function parseDateOnly(value: string): Date {
  const match = DATE_ONLY.exec(value.trim());
  if (!match) {
    throw new BadRequestException('DATE must be YYYY-MM-DD');
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new BadRequestException('DATE must be a valid calendar date');
  }
  return date;
}

export function formatDateOnly(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function allowedSelectOptionIds(
  options: Array<{ id: string; active: boolean }>,
  currentOptionId?: string | null,
): Set<string> {
  const ids = new Set(
    options.filter((option) => option.active).map((option) => option.id),
  );
  if (currentOptionId) {
    ids.add(currentOptionId);
  }
  return ids;
}

export function valueColumnsFromParsed(parsed: ParsedCustomValue): {
  optionId: string | null;
  textValue: string | null;
  numberValue: number | null;
  booleanValue: boolean | null;
  dateValue: Date | null;
} {
  const empty = {
    optionId: null,
    textValue: null,
    numberValue: null,
    booleanValue: null,
    dateValue: null,
  };
  switch (parsed.kind) {
    case 'empty':
      return empty;
    case 'text':
      return { ...empty, textValue: parsed.textValue };
    case 'number':
      return { ...empty, numberValue: parsed.numberValue };
    case 'boolean':
      return { ...empty, booleanValue: parsed.booleanValue };
    case 'date':
      return { ...empty, dateValue: parsed.dateValue };
    case 'select':
      return { ...empty, optionId: parsed.optionId };
    default:
      return empty;
  }
}

export function parseCustomFieldValue(
  type: PositionCustomFieldType,
  value: unknown,
  required: boolean,
  allowedOptionIds: Set<string>,
): ParsedCustomValue {
  if (type === PositionCustomFieldType.BOOLEAN) {
    if (value === undefined || value === null) {
      if (required) {
        throw new BadRequestException('BOOLEAN value is required');
      }
      return { kind: 'empty' };
    }
    if (typeof value !== 'boolean') {
      throw new BadRequestException('BOOLEAN must be true or false');
    }
    return { kind: 'boolean', booleanValue: value };
  }

  if (isEmptyCustomValue(value)) {
    if (required) {
      throw new BadRequestException('This field is required');
    }
    return { kind: 'empty' };
  }

  switch (type) {
    case PositionCustomFieldType.TEXT: {
      if (typeof value !== 'string') {
        throw new BadRequestException('TEXT must be a string');
      }
      const textValue = value.trim();
      if (textValue.length > MAX_TEXT_LENGTH) {
        throw new BadRequestException('TEXT exceeds maximum length');
      }
      return { kind: 'text', textValue };
    }
    case PositionCustomFieldType.NUMBER: {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new BadRequestException('NUMBER must be a finite number');
      }
      return { kind: 'number', numberValue: value };
    }
    case PositionCustomFieldType.DATE: {
      if (typeof value !== 'string') {
        throw new BadRequestException('DATE must be YYYY-MM-DD');
      }
      return { kind: 'date', dateValue: parseDateOnly(value) };
    }
    case PositionCustomFieldType.SELECT: {
      if (typeof value !== 'string') {
        throw new BadRequestException('SELECT must be an option id');
      }
      if (!allowedOptionIds.has(value)) {
        throw new BadRequestException('SELECT option is not valid');
      }
      return { kind: 'select', optionId: value };
    }
    default:
      throw new BadRequestException('Unsupported custom field type');
  }
}
