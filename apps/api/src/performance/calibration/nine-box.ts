export type NineBoxBand = 0 | 1 | 2;

export type NineBoxCellConfig = {
  row: number;
  col: number;
  label: string;
  color: string;
};

export const DEFAULT_NINE_BOX_CELLS: NineBoxCellConfig[] = [
  { row: 0, col: 0, label: 'Riesgo', color: '#b91c1c' },
  { row: 0, col: 1, label: 'Sólido', color: '#94a3b8' },
  { row: 0, col: 2, label: 'Especialista', color: '#7c3aed' },
  { row: 1, col: 0, label: 'Dilema', color: '#d97706' },
  { row: 1, col: 1, label: 'Núcleo', color: '#64748b' },
  { row: 1, col: 2, label: 'Alto desempeño', color: '#2563eb' },
  { row: 2, col: 0, label: 'Enigma', color: '#ca8a04' },
  { row: 2, col: 1, label: 'Crecimiento', color: '#65a30d' },
  { row: 2, col: 2, label: 'Estrella', color: '#15803d' },
];

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export function isNineBoxHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

export type NineBoxScale = {
  /** Scores below this value land in box 1. */
  minimum?: number | null;
  /** Cycle cap (100 or 120). Scores at or above the midpoint of minimum..maximum land in box 3. */
  maximum?: number | null;
};

/** Maps a score into low / mid / high bands. */
export function scoreToNineBoxBand(
  score: number | null | undefined,
  scale?: NineBoxScale,
): NineBoxBand | null {
  if (score == null || !Number.isFinite(score)) return null;
  const minimum = scale?.minimum;
  if (minimum == null || !Number.isFinite(minimum)) {
    if (score < 33.34) return 0;
    if (score < 66.67) return 1;
    return 2;
  }
  if (score < minimum) return 0;
  const maximum =
    scale?.maximum != null && Number.isFinite(scale.maximum)
      ? scale.maximum
      : 100;
  const midpoint = minimum + (maximum - minimum) / 2;
  return score < midpoint ? 1 : 2;
}

export function parseScore(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' || typeof value === 'boolean') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * X (col) = desempeño (overallScore).
 * Y (row) = potencial (competencyScore, fallback overall).
 */
export function scoresToNineBoxCell(params: {
  overallScore: number | null;
  competencyScore: number | null;
  minimum?: number | null;
  maximum?: number | null;
}): { row: NineBoxBand; col: NineBoxBand } | null {
  const scale = { minimum: params.minimum, maximum: params.maximum };
  const col = scoreToNineBoxBand(params.overallScore, scale);
  const row = scoreToNineBoxBand(
    params.competencyScore ?? params.overallScore,
    scale,
  );
  if (col == null || row == null) return null;
  return { row, col };
}
