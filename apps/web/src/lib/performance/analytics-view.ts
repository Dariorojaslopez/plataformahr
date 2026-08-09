import type { OrgBreakdownRow, OrgSnapshotRef } from "@/types/performance";

/** Neutral distribution labels — no qualitative score meaning. */
export const DISTRIBUTION_BUCKET_LABELS = [
  "0–19.99",
  "20–39.99",
  "40–59.99",
  "60–79.99",
  "80–100",
] as const;

export function formatAverageScore(value: number | null): string {
  if (value == null) return "—";
  return `${value.toFixed(2)}%`;
}

export function formatRate(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function snapshotDisplayName(
  snapshot: OrgSnapshotRef | null | undefined,
  emptyLabel: string,
): string {
  if (!snapshot?.name?.trim()) return emptyLabel;
  return snapshot.name;
}

export function submissionProgressLabel(params: {
  submitted: number;
  total: number;
  submittedRate: number;
}): string {
  return `${params.submitted} / ${params.total} enviadas (${formatRate(params.submittedRate)})`;
}

export function sortBreakdownByResultCount(
  rows: OrgBreakdownRow[],
): OrgBreakdownRow[] {
  return [...rows].sort((a, b) => {
    if (b.resultCount !== a.resultCount) return b.resultCount - a.resultCount;
    return a.name.localeCompare(b.name);
  });
}

/** Forbidden qualitative labels for score buckets in admin analytics UI. */
export const FORBIDDEN_QUALITATIVE_SCORE_LABELS = [
  "malo",
  "regular",
  "bueno",
  "excelente",
  "top",
  "ranking",
] as const;
