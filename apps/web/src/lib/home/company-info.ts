export function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function homeInfoScheduleError(
  publishedAt: string,
  unpublishedAt: string,
): string | null {
  const published = fromDatetimeLocalValue(publishedAt);
  if (!published) return "La fecha de publicación es obligatoria.";
  if (!unpublishedAt.trim()) return null;
  const unpublished = fromDatetimeLocalValue(unpublishedAt);
  if (!unpublished) return "La fecha de despublicación no es válida.";
  if (new Date(unpublished).getTime() <= new Date(published).getTime()) {
    return "La fecha de despublicación debe ser posterior a la de publicación.";
  }
  return null;
}

export function hasVisibleCompanyInfo(info: {
  isLive: boolean;
  hasMedia: boolean;
  title: string;
}): boolean {
  return info.isLive && info.hasMedia && Boolean(info.title.trim());
}
