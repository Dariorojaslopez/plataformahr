import { nextSequentialCode } from './sequential-code';

describe('nextSequentialCode', () => {
  it('starts at 001 when nothing numeric exists', () => {
    expect(nextSequentialCode([])).toBe('001');
    expect(nextSequentialCode([null, '', 'OPS', 'FIN'])).toBe('001');
  });

  it('increments from the highest numeric code', () => {
    expect(nextSequentialCode(['001', '003'])).toBe('004');
    expect(nextSequentialCode(['002', 'OPS'])).toBe('003');
    expect(nextSequentialCode(['999'])).toBe('1000');
  });
});
