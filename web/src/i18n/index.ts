/**
 * Story 15 (WIS-11) — the public surface of the i18n module.
 *
 * Components import from here and nowhere deeper: the configured instance,
 * `useT` (the namespace-pinned wrapper over react-i18next's `useTranslation`),
 * and the four `Intl`-backed formatters. Components never call `Intl` or
 * `toLocaleString` directly.
 */
import { useTranslation } from 'react-i18next';
import i18n, { type Locale, NAMESPACES } from './instance';

export { default as i18n } from './instance';
export { type Locale, NAMESPACES, resources, getMissingKeyCount } from './instance';
export { I18nextProvider } from 'react-i18next';
export { formatDate, formatDateTime, formatRelative, formatNumber } from './formatters';

export type Namespace = (typeof NAMESPACES)[number];

/**
 * Pins the namespace so callers write `t('queue.title')`, not
 * `t('tickets:queue.title')` — and `common` keys stay reachable as a
 * fallback namespace. A key is never composed at runtime from a variable
 * fragment, or the no-literals check cannot see it.
 */
export function useT(ns: Namespace = 'common') {
  const { t, i18n: instance } = useTranslation([ns, 'common']);
  return { t, i18n: instance, locale: (instance.resolvedLanguage as Locale) ?? 'en' };
}

export const supportedLocales: Locale[] = ['en', 'ar'];

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'ar';
}

/** Set the i18next language without touching persistence or the API (that is UiPreferencesContext's job). */
export function applyI18nLanguage(locale: Locale) {
  if (i18n.language !== locale) {
    void i18n.changeLanguage(locale);
  }
}
