// Story 13 (CSAT Collection) shipped this as a two-locale string module for
// the PUBLIC feedback page. Story 16 (WIS-17) absorbed its content into
// web/src/i18n/locales/{en,ar}/csat.json and kept this file's one real
// contract: there is no signed-in user and no customer locale field anywhere
// in the MVP, so the page cannot fall back to a per-user server preference.
// Detection + an explicit on-page toggle is the whole contract, unchanged.

export type CsatLocale = 'en' | 'ar';

/**
 * The browser decides. A `navigator.language` beginning with `ar` renders
 * Arabic; everything else renders English. The on-page toggle overrides this.
 */
export function detectCsatLocale(language: string | undefined = navigatorLanguage()): CsatLocale {
  return (language ?? '').toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

export function csatDir(locale: CsatLocale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

function navigatorLanguage(): string | undefined {
  return typeof navigator !== 'undefined' ? navigator.language : undefined;
}
