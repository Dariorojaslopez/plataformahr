import {
  calculateEvaluationScore,
  roundScorePercentage,
} from './evaluation-score';
import type { ScoreCompetencyInput } from './evaluation-score';

describe('calculateEvaluationScore', () => {
  const levels15 = [
    { value: 1 },
    { value: 2 },
    { value: 3 },
    { value: 4 },
    { value: 5 },
  ];
  const levels010 = [
    { value: 0 },
    { value: 2 },
    { value: 4 },
    { value: 6 },
    { value: 8 },
    { value: 10 },
  ];

  it('computes unweighted average on 1–5 scale', () => {
    const input: ScoreCompetencyInput[] = [
      {
        id: 'a',
        required: true,
        weight: null,
        levels: levels15,
        response: { ratingValue: 4 },
      },
      {
        id: 'b',
        required: true,
        weight: null,
        levels: levels15,
        response: { ratingValue: 5 },
      },
      {
        id: 'c',
        required: true,
        weight: null,
        levels: levels15,
        response: { ratingValue: 3 },
      },
    ];
    // normalized: 75, 100, 50 → avg 75
    const result = calculateEvaluationScore(input);
    expect(result.weighted).toBe(false);
    expect(result.scorePercentage).toBe(75);
  });

  it('normalizes 0–10 scale', () => {
    const input: ScoreCompetencyInput[] = [
      {
        id: 'a',
        required: true,
        weight: null,
        levels: levels010,
        response: { ratingValue: 8 },
      },
    ];
    expect(calculateEvaluationScore(input).scorePercentage).toBe(80);
  });

  it('supports mixed scales unweighted', () => {
    const input: ScoreCompetencyInput[] = [
      {
        id: 'a',
        required: true,
        weight: null,
        levels: levels15,
        response: { ratingValue: 4 },
      }, // 75
      {
        id: 'b',
        required: true,
        weight: null,
        levels: levels010,
        response: { ratingValue: 8 },
      }, // 80
    ];
    expect(calculateEvaluationScore(input).scorePercentage).toBe(77.5);
  });

  it('computes weighted score', () => {
    const input: ScoreCompetencyInput[] = [
      {
        id: 'a',
        required: true,
        weight: 60,
        levels: levels15,
        response: { ratingValue: 4 },
      }, // 75
      {
        id: 'b',
        required: true,
        weight: 40,
        levels: levels15,
        response: { ratingValue: 5 },
      }, // 100
    ];
    // 0.75*60 + 1.0*40 = 85
    expect(calculateEvaluationScore(input).scorePercentage).toBe(85);
  });

  it('renormalizes weights when optional is omitted', () => {
    const input: ScoreCompetencyInput[] = [
      {
        id: 'a',
        required: true,
        weight: 50,
        levels: levels15,
        response: { ratingValue: 4 },
      }, // 75
      {
        id: 'b',
        required: true,
        weight: 30,
        levels: levels15,
        response: { ratingValue: 5 },
      }, // 100
      {
        id: 'c',
        required: false,
        weight: 20,
        levels: levels15,
        response: null,
      },
    ];
    // (0.75*50 + 1.0*30) / 80 = 67.5/80 = 0.84375 → 84.38
    expect(calculateEvaluationScore(input).scorePercentage).toBe(84.38);
  });

  it('excludes unanswered optional from unweighted average', () => {
    const input: ScoreCompetencyInput[] = [
      {
        id: 'a',
        required: true,
        weight: null,
        levels: levels15,
        response: { ratingValue: 5 },
      },
      {
        id: 'b',
        required: false,
        weight: null,
        levels: levels15,
        response: null,
      },
    ];
    expect(calculateEvaluationScore(input).scorePercentage).toBe(100);
  });

  it('rejects zero responses', () => {
    expect(() =>
      calculateEvaluationScore([
        {
          id: 'a',
          required: false,
          weight: null,
          levels: levels15,
          response: null,
        },
      ]),
    ).toThrow(/al menos una respuesta/);
  });

  it('rejects invalid max=min scale', () => {
    expect(() =>
      calculateEvaluationScore([
        {
          id: 'a',
          required: true,
          weight: null,
          levels: [{ value: 3 }, { value: 3 }],
          response: { ratingValue: 3 },
        },
      ]),
    ).toThrow(/maxValue/);
  });

  it('rounds to two decimals', () => {
    expect(roundScorePercentage(82.4999999997)).toBe(82.5);
    expect(roundScorePercentage(84.375)).toBe(84.38);
  });
});
