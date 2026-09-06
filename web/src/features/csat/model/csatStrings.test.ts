import { describe, it, expect } from 'vitest';
import { csatDir, detectCsatLocale } from './csatStrings';

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
