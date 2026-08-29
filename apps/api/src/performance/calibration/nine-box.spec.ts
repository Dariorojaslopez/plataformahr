import {
  DEFAULT_NINE_BOX_CELLS,
  isNineBoxHexColor,
  scoreToNineBoxBand,
  scoresToNineBoxCell,
} from './nine-box';

describe('nine-box', () => {
  it('seeds nine distinct cells', () => {
    expect(DEFAULT_NINE_BOX_CELLS).toHaveLength(9);
    const keys = new Set(
      DEFAULT_NINE_BOX_CELLS.map((cell) => `${cell.row}:${cell.col}`),
    );
    expect(keys.size).toBe(9);
  });

  it('accepts hex colors', () => {
    expect(isNineBoxHexColor('#15803d')).toBe(true);
    expect(isNineBoxHexColor('#fff')).toBe(false);
    expect(isNineBoxHexColor('green')).toBe(false);
  });

  it('bands scores into terciles', () => {
    expect(scoreToNineBoxBand(0)).toBe(0);
    expect(scoreToNineBoxBand(33.33)).toBe(0);
    expect(scoreToNineBoxBand(33.34)).toBe(1);
    expect(scoreToNineBoxBand(66.66)).toBe(1);
    expect(scoreToNineBoxBand(66.67)).toBe(2);
    expect(scoreToNineBoxBand(100)).toBe(2);
    expect(scoreToNineBoxBand(null)).toBeNull();
  });

  it('places a collaborator by overall (X) and competency (Y)', () => {
    expect(
      scoresToNineBoxCell({ overallScore: 80, competencyScore: 90 }),
    ).toEqual({ row: 2, col: 2 });
    expect(
      scoresToNineBoxCell({ overallScore: 20, competencyScore: 50 }),
    ).toEqual({ row: 1, col: 0 });
    expect(
      scoresToNineBoxCell({ overallScore: null, competencyScore: 80 }),
    ).toBeNull();
  });
});
