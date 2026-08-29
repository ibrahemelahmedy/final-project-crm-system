import { describe, it, expect } from 'vitest';
import { CSAT_STRINGS, csatDir, detectCsatLocale } from './csatStrings';

describe('detectCsatLocale', () => {
  it('renders Arabic + rtl for an ar-* browser language', () => {
    expect(detectCsatLocale('ar-EG')).toBe('ar');
    expect(csatDir('ar')).toBe('rtl');
  });

  it('renders English for en-GB and for an unknown tag', () => {
    expect(detectCsatLocale('en-GB')).toBe('en');
    expect(detectCsatLocale('zz-ZZ')).toBe('en');
    expect(detectCsatLocale(undefined)).toBe('en');
    expect(csatDir('en')).toBe('ltr');
  });
});

describe('CSAT_STRINGS', () => {
  it('has every en key present in ar (no half-translated ship)', () => {
    expect(Object.keys(CSAT_STRINGS.ar).sort()).toEqual(Object.keys(CSAT_STRINGS.en).sort());
  });

  it('keeps a fixed five-step 1-5 scale in both locales', () => {
    expect(CSAT_STRINGS.en.ratingOptions).toHaveLength(5);
    expect(CSAT_STRINGS.ar.ratingOptions).toHaveLength(5);
    expect(CSAT_STRINGS.en.ratingEmojis).toHaveLength(5);
  });
});
