import { serializeCompetency } from './competency.serialize';

describe('serializeCompetency', () => {
  it('exposes assigned job levels and hides the join rows', () => {
    const serialized = serializeCompetency({
      id: 'c1',
      name: 'Liderazgo',
      jobLevelAssignments: [
        {
          jobLevel: {
            id: 'jl-1',
            name: 'Senior',
            rank: 3,
            status: 'ACTIVE',
          },
        },
      ],
    });

    expect(serialized).toEqual({
      id: 'c1',
      name: 'Liderazgo',
      jobLevels: [
        { id: 'jl-1', name: 'Senior', rank: 3, status: 'ACTIVE' },
      ],
    });
    expect(serialized).not.toHaveProperty('jobLevelAssignments');
  });
});
