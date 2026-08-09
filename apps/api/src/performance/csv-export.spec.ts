import {
  buildCsvDocument,
  buildCsvRow,
  buildPerformanceResultsCsvFilename,
  CSV_EXPORT_MAX_ROWS,
  csvExportExceedsLimit,
  csvExportLimitMessage,
  escapeCsvField,
  sanitizeCsvCell,
  sanitizeCsvFilenamePart,
} from './csv-export';

describe('csv export helpers', () => {
  it('escapes comma, quotes, newline and CRLF', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCsvField('a\r\nb')).toBe('"a\r\nb"');
  });

  it('protects formula injection prefixes', () => {
    expect(sanitizeCsvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(sanitizeCsvCell('+cmd')).toBe("'+cmd");
    expect(sanitizeCsvCell('-1+1')).toBe("'-1+1");
    expect(sanitizeCsvCell('@foo')).toBe("'@foo");
    expect(escapeCsvField('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
  });

  it('does not alter safe generated numbers', () => {
    expect(escapeCsvField(82.5)).toBe('82.5');
    expect(escapeCsvField('78.13')).toBe('78.13');
  });

  it('builds CRLF document with UTF-8 BOM', () => {
    const doc = buildCsvDocument({
      headers: ['Colaborador', 'Resultado'],
      rows: [['Ada', 90]],
    });
    expect(doc.startsWith('\uFEFF')).toBe(true);
    expect(doc).toContain('\r\n');
    expect(buildCsvRow(['a', 'b'])).toBe('a,b');
  });

  it('sanitizes filename parts', () => {
    expect(sanitizeCsvFilenamePart('Ciclo 2026 / Q1')).toBe('Ciclo-2026-Q1');
    expect(
      buildPerformanceResultsCsvFilename({
        cycleNameOrId: 'Ciclo A',
        date: new Date('2026-08-09T12:00:00.000Z'),
      }),
    ).toBe('resultados-desempeno-Ciclo-A-2026-08-09.csv');
  });

  it('enforces export row limit', () => {
    expect(csvExportExceedsLimit(CSV_EXPORT_MAX_ROWS)).toBe(false);
    expect(csvExportExceedsLimit(CSV_EXPORT_MAX_ROWS + 1)).toBe(true);
    expect(csvExportLimitMessage(12_345)).toContain('12345');
    expect(csvExportLimitMessage(12_345)).toContain(
      String(CSV_EXPORT_MAX_ROWS),
    );
  });
});
