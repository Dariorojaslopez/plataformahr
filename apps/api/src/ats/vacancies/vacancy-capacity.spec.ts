import {
  effectiveVacancyHeadcount,
  hasHireCapacity,
  remainingHirePlazas,
} from './vacancy-capacity';

describe('vacancy capacity', () => {
  it('keeps the original process plazas when the cargo was not expanded', () => {
    expect(
      remainingHirePlazas({ headcount: 2, filledCount: 0 }, 2, 1),
    ).toBe(2);
    expect(hasHireCapacity({ headcount: 1, filledCount: 0 }, 1, 0)).toBe(true);
  });

  it('absorbs extra org-chart plazas into a process that already looks full', () => {
    expect(
      remainingHirePlazas({ headcount: 1, filledCount: 1 }, 3, 1),
    ).toBe(2);
    expect(
      effectiveVacancyHeadcount({ headcount: 1, filledCount: 1 }, 3, 1),
    ).toBe(3);
    expect(hasHireCapacity({ headcount: 1, filledCount: 1 }, 3, 1)).toBe(true);
  });

  it('blocks when both the process and the cargo are full', () => {
    expect(hasHireCapacity({ headcount: 1, filledCount: 1 }, 1, 1)).toBe(false);
    expect(
      remainingHirePlazas({ headcount: 1, filledCount: 1 }, 1, 1),
    ).toBe(0);
  });
});
