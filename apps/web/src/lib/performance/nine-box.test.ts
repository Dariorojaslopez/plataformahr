import { describe, expect, it } from "vitest";
import { scoreToNineBoxBand, scoresToNineBoxCell } from "./nine-box";

describe("nine-box placement", () => {
  it("maps terciles", () => {
    expect(scoreToNineBoxBand(10)).toBe(0);
    expect(scoreToNineBoxBand(50)).toBe(1);
    expect(scoreToNineBoxBand(90)).toBe(2);
  });

  it("uses the cycle minimum as the floor of box 1", () => {
    expect(scoreToNineBoxBand(69, { minimum: 70, maximum: 100 })).toBe(0);
    expect(scoreToNineBoxBand(70, { minimum: 70, maximum: 100 })).toBe(1);
    expect(scoreToNineBoxBand(85, { minimum: 70, maximum: 100 })).toBe(2);
  });

  it("uses overall as X and competency as Y", () => {
    expect(
      scoresToNineBoxCell({ overallScore: 80, competencyScore: 20 }),
    ).toEqual({ row: 0, col: 2 });
  });
});
