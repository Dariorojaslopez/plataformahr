import { parseCsv, isCsvRowEmpty, CsvParseError } from './csv-parse';

describe('parseCsv', () => {
  it('parses simple rows and quoted commas', () => {
    const rows = parseCsv('a,b\n"x,y",z\n');
    expect(rows).toEqual([
      ['a', 'b'],
      ['x,y', 'z'],
    ]);
  });

  it('strips BOM and handles escaped quotes', () => {
    const rows = parseCsv('\uFEFF"a""b",c');
    expect(rows).toEqual([['a"b', 'c']]);
  });

  it('rejects unclosed quotes', () => {
    expect(() => parseCsv('"abc')).toThrow(CsvParseError);
  });

  it('detects empty rows', () => {
    expect(isCsvRowEmpty(['', '  ', ''])).toBe(true);
    expect(isCsvRowEmpty(['a', ''])).toBe(false);
  });
});
