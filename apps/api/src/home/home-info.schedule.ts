export function isCompanyHomeInfoLive(
  row: { publishedAt: Date; unpublishedAt: Date | null },
  now: Date = new Date(),
): boolean {
  if (row.publishedAt.getTime() > now.getTime()) return false;
  if (row.unpublishedAt && row.unpublishedAt.getTime() <= now.getTime()) {
    return false;
  }
  return true;
}

export function hasPublicCompanyHomeInfoContent(row: {
  title: string;
  fileName: string | null;
}): boolean {
  return Boolean(row.title.trim()) && Boolean(row.fileName);
}

export function assertValidHomeInfoSchedule(
  publishedAt: Date,
  unpublishedAt: Date | null,
): void {
  if (unpublishedAt && unpublishedAt.getTime() <= publishedAt.getTime()) {
    throw new Error('UNPUBLISH_BEFORE_PUBLISH');
  }
}
