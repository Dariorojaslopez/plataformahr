import {
  wouldCreateParentCycle,
  wouldCreateReportingCycle,
} from './organization.helpers';

describe('organization helpers', () => {
  it('detects area parent cycles', () => {
    const parents = new Map<string, string | null>([
      ['a', null],
      ['b', 'a'],
      ['c', 'b'],
    ]);
    expect(wouldCreateParentCycle('a', 'c', parents)).toBe(true);
    expect(wouldCreateParentCycle('c', 'a', parents)).toBe(false);
  });

  it('detects self-parent as a cycle', () => {
    const parents = new Map<string, string | null>([['a', null]]);
    expect(wouldCreateParentCycle('a', 'a', parents)).toBe(true);
  });

  it('detects reporting cycles A->B->C->A', () => {
    const reports = new Map<string, string[]>([
      ['a', ['b']],
      ['b', ['c']],
    ]);
    expect(wouldCreateReportingCycle('c', 'a', reports)).toBe(true);
    expect(wouldCreateReportingCycle('a', 'c', reports)).toBe(false);
  });

  it('rejects self reporting', () => {
    expect(wouldCreateReportingCycle('a', 'a', new Map())).toBe(true);
  });
});
