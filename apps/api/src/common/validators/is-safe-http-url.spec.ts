import { isSafeHttpUrlValue } from './is-safe-http-url';

describe('isSafeHttpUrlValue', () => {
  it('allows http(s)', () => {
    expect(isSafeHttpUrlValue('https://meet.example.com/x')).toBe(true);
    expect(isSafeHttpUrlValue('http://localhost:3000/path')).toBe(true);
  });

  it('rejects unsafe schemes', () => {
    expect(isSafeHttpUrlValue('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpUrlValue('data:text/html,hi')).toBe(false);
    expect(isSafeHttpUrlValue('file:///etc/passwd')).toBe(false);
  });

  it('allows empty for optional fields', () => {
    expect(isSafeHttpUrlValue('')).toBe(true);
    expect(isSafeHttpUrlValue(null)).toBe(true);
    expect(isSafeHttpUrlValue(undefined)).toBe(true);
  });
});
