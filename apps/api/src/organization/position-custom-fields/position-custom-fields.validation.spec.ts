import { BadRequestException } from '@nestjs/common';
import { PositionCustomFieldType } from '@prisma/client';
import {
  allowedSelectOptionIds,
  assertCustomFieldKey,
  formatDateOnly,
  isEmptyCustomValue,
  parseCustomFieldValue,
  parseDateOnly,
} from './position-custom-fields.validation';

describe('position custom field validation', () => {
  it('accepts a stable lowercase key', () => {
    expect(assertCustomFieldKey('centro_costo')).toBe('centro_costo');
    expect(assertCustomFieldKey('CodigoSAP')).toBe('codigosap');
  });

  it('rejects invalid keys', () => {
    expect(() => assertCustomFieldKey('1bad')).toThrow(BadRequestException);
    expect(() => assertCustomFieldKey('Bad Key')).toThrow(BadRequestException);
    expect(() => assertCustomFieldKey('a')).toThrow(BadRequestException);
  });

  it('parses TEXT', () => {
    expect(
      parseCustomFieldValue(
        PositionCustomFieldType.TEXT,
        '  hola  ',
        false,
        new Set(),
      ),
    ).toEqual({ kind: 'text', textValue: 'hola' });
  });

  it('parses NUMBER', () => {
    expect(
      parseCustomFieldValue(
        PositionCustomFieldType.NUMBER,
        12.5,
        true,
        new Set(),
      ),
    ).toEqual({ kind: 'number', numberValue: 12.5 });
    expect(() =>
      parseCustomFieldValue(
        PositionCustomFieldType.NUMBER,
        '12',
        true,
        new Set(),
      ),
    ).toThrow(BadRequestException);
  });

  it('parses BOOLEAN without treating false as empty', () => {
    expect(
      parseCustomFieldValue(
        PositionCustomFieldType.BOOLEAN,
        false,
        true,
        new Set(),
      ),
    ).toEqual({ kind: 'boolean', booleanValue: false });
    expect(isEmptyCustomValue(false)).toBe(false);
  });

  it('parses DATE and rejects invalid calendars', () => {
    const parsed = parseCustomFieldValue(
      PositionCustomFieldType.DATE,
      '2026-02-01',
      true,
      new Set(),
    );
    expect(parsed.kind).toBe('date');
    if (parsed.kind === 'date') {
      expect(formatDateOnly(parsed.dateValue)).toBe('2026-02-01');
    }
    expect(() => parseDateOnly('2026-02-30')).toThrow(BadRequestException);
  });

  it('parses SELECT against allowed options', () => {
    const optionId = '11111111-1111-4111-8111-111111111111';
    expect(
      parseCustomFieldValue(
        PositionCustomFieldType.SELECT,
        optionId,
        true,
        new Set([optionId]),
      ),
    ).toEqual({ kind: 'select', optionId });
    expect(() =>
      parseCustomFieldValue(
        PositionCustomFieldType.SELECT,
        '22222222-2222-4222-8222-222222222222',
        true,
        new Set([optionId]),
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects missing required values and allows optional empty', () => {
    expect(() =>
      parseCustomFieldValue(PositionCustomFieldType.TEXT, '', true, new Set()),
    ).toThrow(BadRequestException);
    expect(
      parseCustomFieldValue(PositionCustomFieldType.TEXT, '', false, new Set()),
    ).toEqual({ kind: 'empty' });
  });

  it('keeps a currently stored inactive SELECT option allowed', () => {
    const active = 'opt-active';
    const historic = 'opt-historic';
    const allowed = allowedSelectOptionIds(
      [
        { id: active, active: true },
        { id: historic, active: false },
      ],
      historic,
    );
    expect(allowed.has(historic)).toBe(true);
    expect(allowed.has(active)).toBe(true);
  });
});
