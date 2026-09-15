/** Display format for public candidate forms: día/mes/año. */

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

export function isoDateToDisplay(iso: string): string {
  const match = ISO_RE.exec(iso.trim());
  if (!match) return "";
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

/** Returns ISO `YYYY-MM-DD`, `""` if empty, or `null` if invalid. */
export function displayDateToIso(display: string): string | null {
  const trimmed = display.trim();
  if (!trimmed) return "";
  const match = DMY_RE.exec(trimmed);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    !Number.isInteger(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    year < 1900 ||
    year > 2100
  ) {
    return null;
  }
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
