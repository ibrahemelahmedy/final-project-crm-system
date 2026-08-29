import { describe, it, expect, vi, afterEach } from 'vitest';
import i18n, { getMissingKeyCount } from './instance';

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('i18n missing-key handling', () => {
  it('falls back to the English value AND logs the miss for a key absent in the active locale', async () => {
    // Seed a key into en only.
    i18n.addResource('en', 'common', 'onlyInEnglish.test', 'English only value');

    await i18n.changeLanguage('ar');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const before = getMissingKeyCount();

    const rendered = i18n.t('common:onlyInEnglish.test');

    expect(rendered).toBe('English only value');
    expect(getMissingKeyCount()).toBeGreaterThan(before);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('renders neither the raw dotted key nor an empty string for a key present in neither locale', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const rendered = i18n.t('common:totally.absent.queueTitle');

    expect(rendered).not.toBe('common:totally.absent.queueTitle');
    expect(rendered).not.toBe('totally.absent.queueTitle');
    expect(rendered).not.toBe('');
    // parseMissingKeyHandler humanises the last segment.
    expect(rendered.toLowerCase()).toContain('queue title');
    warn.mockRestore();
  });
});
