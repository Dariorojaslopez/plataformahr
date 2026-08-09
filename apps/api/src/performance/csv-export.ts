/**
 * CSV helpers for Performance admin export.
 * UTF-8 + RFC 4180-style escaping + spreadsheet formula injection protection.
 */

export const CSV_EXPORT_MAX_ROWS = 10_000;

export function csvExportExceedsLimit(
  total: number,
  max: number = CSV_EXPORT_MAX_ROWS,
): boolean {
  return total > max;
}

export function csvExportLimitMessage(
  total: number,
  max: number = CSV_EXPORT_MAX_ROWS,
): string {
  return `CSV export limited to ${max} rows. Apply filters to reduce the result set (matched ${total}).`;
}

const FORMULA_PREFIX = /^[=+\-@]/;

/** Neutralize spreadsheet formula injection without altering safe numbers. */
export function sanitizeCsvCell(value: string): string {
  if (FORMULA_PREFIX.test(value)) {
    return `'${value}`;
  }
  return value;
}

/** Escape a CSV field (RFC 4180). Applies formula sanitization first. */
export function escapeCsvField(
  value: string | number | null | undefined,
): string {
  if (value == null) return '';
  const asString =
    typeof value === 'number' ? String(value) : sanitizeCsvCell(String(value));
  if (/[",\r\n]/.test(asString)) {
    return `"${asString.replace(/"/g, '""')}"`;
  }
  return asString;
}

export function buildCsvRow(
  fields: Array<string | number | null | undefined>,
): string {
  return fields.map(escapeCsvField).join(',');
}

export function buildCsvDocument(params: {
  headers: string[];
  rows: Array<Array<string | number | null | undefined>>;
}): string {
  const lines = [
    buildCsvRow(params.headers),
    ...params.rows.map((row) => buildCsvRow(row)),
  ];
  // UTF-8 BOM for Excel on Windows
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function sanitizeCsvFilenamePart(value: string): string {
  return (
    value
      .normalize('NFKD')
      .replace(/[^\w.-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'ciclo'
  );
}

export function buildPerformanceResultsCsvFilename(params: {
  cycleNameOrId: string;
  date?: Date;
}): string {
  const d = params.date ?? new Date();
  const yyyy = d.toISOString().slice(0, 10);
  const cycle = sanitizeCsvFilenamePart(params.cycleNameOrId);
  return `resultados-desempeno-${cycle}-${yyyy}.csv`;
}
