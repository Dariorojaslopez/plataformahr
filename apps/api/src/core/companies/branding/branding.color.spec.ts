import { normalizeBrandPrimaryColor } from './branding.color';

describe('normalizeBrandPrimaryColor', () => {
  it('accepts #RRGGBB and stores uppercase', () => {
    expect(normalizeBrandPrimaryColor('#0f5c5a')).toBe('#0F5C5A');
    expect(normalizeBrandPrimaryColor('  #AABBCC  ')).toBe('#AABBCC');
  });

  it('rejects CSS, shorthand, and expressions', () => {
    expect(normalizeBrandPrimaryColor('#fff')).toBeNull();
    expect(normalizeBrandPrimaryColor('red')).toBeNull();
    expect(normalizeBrandPrimaryColor('url(https://x)')).toBeNull();
    expect(normalizeBrandPrimaryColor('var(--primary)')).toBeNull();
    expect(normalizeBrandPrimaryColor('#0F5C5A;background:red')).toBeNull();
    expect(normalizeBrandPrimaryColor('javascript:alert(1)')).toBeNull();
    expect(normalizeBrandPrimaryColor('#GGGGGG')).toBeNull();
  });
});
