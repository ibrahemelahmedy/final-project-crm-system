import { describe, it, expect, afterEach } from 'vitest';
import i18n from './instance';
import { formatDate, formatDateTime, formatRelative, formatNumber } from './formatters';

const TS = '2026-03-14T09:30:00Z';

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('i18n formatters', () => {
  it('renders the same timestamp differently in en and ar', async () => {
    await i18n.changeLanguage('en');
    const en = formatDate(TS);
    await i18n.changeLanguage('ar');
    const ar = formatDate(TS);
    expect(en).not.toBe(ar);
    expect(en).toBeTruthy();
    expect(ar).toBeTruthy();
  });

  it('uses Latin digits in both locales', async () => {
    const easternArabic = /[٠-٩۰-۹]/;

    await i18n.changeLanguage('en');
    expect(formatNumber(1234567)).toMatch(/[0-9]/);
    expect(formatNumber(1234567)).not.toMatch(easternArabic);
    expect(formatDateTime(TS)).not.toMatch(easternArabic);

    await i18n.changeLanguage('ar');
    expect(formatNumber(1234567)).toMatch(/[0-9]/);
    expect(formatNumber(1234567)).not.toMatch(easternArabic);
    expect(formatDate(TS)).not.toMatch(easternArabic);
    expect(formatDateTime(TS)).not.toMatch(easternArabic);
    expect(formatRelative(TS, new Date(TS))).not.toMatch(easternArabic);
  });

  it('formats relative time correctly in both locales', async () => {
    const now = new Date('2026-03-14T09:30:00Z');
    const threeDaysAgo = new Date('2026-03-11T09:30:00Z');

    await i18n.changeLanguage('en');
    expect(formatRelative(threeDaysAgo, now)).toMatch(/3 days ago/i);

    await i18n.changeLanguage('ar');
    const ar = formatRelative(threeDaysAgo, now);
    expect(ar).toContain('3');
    expect(ar).not.toMatch(/days/i);
  });

  it('is driven by the i18next locale, not an argument', async () => {
    await i18n.changeLanguage('ar');
    const a = formatDate(TS);
    await i18n.changeLanguage('en');
    const b = formatDate(TS);
    // Same call, no locale argument — the output changes purely because the
    // active i18next language changed.
    expect(a).not.toBe(b);
  });

  it('returns "" for an unparseable date rather than throwing', () => {
    expect(formatDate('not-a-date')).toBe('');
    expect(formatDateTime('')).toBe('');
    expect(formatRelative('nope')).toBe('');
  });
});
