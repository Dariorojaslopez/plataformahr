/**
 * Weight semantics (aligned with API):
 * - All null → unweighted (OK).
 * - Any non-null → all must be non-null and sum exactly 100.
 */

export function sumWeights(
  weights: Array<string | number | null | undefined>,
): number | null {
  const numbers: number[] = [];
  for (const w of weights) {
    if (w == null || w === "") continue;
    const n = Number(w);
    if (!Number.isFinite(n)) return null;
    numbers.push(n);
  }
  if (numbers.length === 0) return null;
  return numbers.reduce((acc, n) => acc + n, 0);
}

export function canActivateWeights(
  weights: Array<string | number | null | undefined>,
): boolean {
  if (weights.length === 0) return true;

  const normalized: Array<number | null> = weights.map((w) => {
    if (w == null || w === "") return null;
    const n = Number(w);
    return Number.isFinite(n) ? n : null;
  });

  const anyWeighted = normalized.some((w) => w != null);
  if (!anyWeighted) return true;

  if (normalized.some((w) => w == null)) return false;

  const total = normalized.reduce<number>((acc, w) => acc + (w as number), 0);
  return Math.abs(total - 100) < 0.001;
}
