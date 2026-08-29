export type NineBoxBand = 0 | 1 | 2;

export type NineBoxCellConfig = {
  row: number;
  col: number;
  label: string;
  color: string;
};

export const DEFAULT_NINE_BOX_CELLS: NineBoxCellConfig[] = [
  { row: 0, col: 0, label: "Riesgo", color: "#b91c1c" },
  { row: 0, col: 1, label: "Sólido", color: "#94a3b8" },
  { row: 0, col: 2, label: "Especialista", color: "#7c3aed" },
  { row: 1, col: 0, label: "Dilema", color: "#d97706" },
  { row: 1, col: 1, label: "Núcleo", color: "#64748b" },
  { row: 1, col: 2, label: "Alto desempeño", color: "#2563eb" },
  { row: 2, col: 0, label: "Enigma", color: "#ca8a04" },
  { row: 2, col: 1, label: "Crecimiento", color: "#65a30d" },
  { row: 2, col: 2, label: "Estrella", color: "#15803d" },
];

export function scoreToNineBoxBand(
  score: number | null | undefined,
): NineBoxBand | null {
  if (score == null || !Number.isFinite(score)) return null;
  if (score < 33.34) return 0;
  if (score < 66.67) return 1;
  return 2;
}

export function parseScore(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(String(value));
  return Number.isFinite(n) ? n : null;
}

export function scoresToNineBoxCell(params: {
  overallScore: number | null;
  competencyScore: number | null;
}): { row: NineBoxBand; col: NineBoxBand } | null {
  const col = scoreToNineBoxBand(params.overallScore);
  const row = scoreToNineBoxBand(
    params.competencyScore ?? params.overallScore,
  );
  if (col == null || row == null) return null;
  return { row, col };
}

export function cellAt(
  cells: NineBoxCellConfig[],
  row: number,
  col: number,
): NineBoxCellConfig | undefined {
  return cells.find((cell) => cell.row === row && cell.col === col);
}
