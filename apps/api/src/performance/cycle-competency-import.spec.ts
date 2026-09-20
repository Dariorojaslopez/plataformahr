import {
  buildCycleCompetencyImports,
  competencyIdsOnlyOnRemovedLevels,
} from './cycle-competency-import';

describe('buildCycleCompetencyImports', () => {
  it('skips competencies already on the cycle and duplicates', () => {
    const result = buildCycleCompetencyImports({
      existingCompetencyIds: ['a'],
      incoming: [
        { competencyId: 'a', scaleId: 's1' },
        { competencyId: 'b', scaleId: 's2' },
        { competencyId: 'b', scaleId: 's2' },
        { competencyId: 'c', scaleId: 's3' },
      ],
      startingOrder: 2,
    });

    expect(result.missingScaleIds).toEqual([]);
    expect(result.rows).toEqual([
      { competencyId: 'b', scaleId: 's2', order: 2, required: true },
      { competencyId: 'c', scaleId: 's3', order: 3, required: true },
    ]);
  });

  it('collects incoming competencies that have no scale', () => {
    const result = buildCycleCompetencyImports({
      existingCompetencyIds: [],
      incoming: [
        { competencyId: 'a', scaleId: null },
        { competencyId: 'b', scaleId: 's1' },
      ],
      startingOrder: 0,
    });

    expect(result.missingScaleIds).toEqual(['a']);
    expect(result.rows).toEqual([
      { competencyId: 'b', scaleId: 's1', order: 0, required: true },
    ]);
  });
});

describe('competencyIdsOnlyOnRemovedLevels', () => {
  it('returns competencies that no remaining person still covers', () => {
    expect(
      competencyIdsOnlyOnRemovedLevels({
        removedCompetencyIds: ['a', 'b', 'a'],
        remainingCompetencyIds: ['b', 'c'],
      }),
    ).toEqual(['a']);
  });
});
