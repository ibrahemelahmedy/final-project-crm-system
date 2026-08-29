import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { applyI18nLanguage, type Locale } from '../../i18n';

export type Theme = 'system' | 'light' | 'dark';
export type Direction = 'ltr' | 'rtl';

type UiPreferencesContextType = {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  /** Story 15 (WIS-11): derived from `locale`, no longer independently settable. */
  direction: Direction;
  locale: Locale;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  /** Sets state, persists to `wisal-lang`, and PATCHes the server. */
  setLocale: (l: Locale) => void;
  /** Reconcile from `GET /api/user` / the login response WITHOUT re-PATCHing — the server wins on a cold load. */
  syncLocaleFromServer: (l: Locale) => void;
  /** Non-null when the last server PATCH failed; the local choice still applies on this device. */
  localeError: string | null;
  clearLocaleError: () => void;
};

const UiPreferencesContext = createContext<UiPreferencesContextType | undefined>(undefined);

const LANG_KEY = 'wisal-lang';

function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem('wisal-theme') as Theme | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {}
  return 'system';
}

// Read synchronously before first paint — the same thing the provider already
// did for direction. This local copy is what prevents a flash of English
// before the server value arrives on a cold load.
function getInitialLocale(): Locale {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'ar') return 'ar';
  } catch {}
  return 'en';
}

function getSystemPrefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

const localeToDirection = (l: Locale): Direction => (l === 'ar' ? 'rtl' : 'ltr');

export const UiPreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(getSystemPrefersDark);
  const [localeError, setLocaleError] = useState<string | null>(null);

  const direction: Direction = localeToDirection(locale);

  // Keep the i18next instance in step with the provider — provider → i18next →
  // strings, one direction only.
  useEffect(() => {
    applyI18nLanguage(locale);
  }, [locale]);

  useEffect(() => {
    let mql: MediaQueryList;
    try {
      mql = window.matchMedia('(prefers-color-scheme: dark)');
    } catch {
      return;
    }
    const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mql.addEventListener?.('change', handler);
    return () => mql.removeEventListener?.('change', handler);
  }, []);

  const resolvedTheme: 'light' | 'dark' = theme === 'system' ? (systemPrefersDark ? 'dark' : 'light') : theme;

  // Applied to <html>, not a wrapper div, so every overlay (the drawer
  // included) sees the same theme, direction, and lang.
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    document.documentElement.dir = direction;
    document.documentElement.lang = locale;
  }, [direction, locale]);

  // Persisted ONLY on an explicit call — never on mount/render.
  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem('wisal-theme', next);
    } catch {}
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  const persistLocale = useCallback((next: Locale) => {
    try {
      // Same storage key and 'ar'/'en' vocabulary that predates this story, so
      // an existing saved preference keeps meaning the same thing.
      localStorage.setItem(LANG_KEY, next);
    } catch {}
  }, []);

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      applyI18nLanguage(next);
      persistLocale(next);
      setLocaleError(null);

      // A network blip does not undo the user's intent — the UI stays
      // switched. Retry once, then surface a non-blocking message.
      const send = () => Promise.resolve(api.patch?.('/user/preferences', { locale: next }));
      send()
        .catch(() => send())
        .catch(() => setLocaleError('sync-failed'));
    },
    [persistLocale]
  );

  const syncLocaleFromServer = useCallback(
    (next: Locale) => {
      setLocaleState((current) => {
        if (current !== next) {
          applyI18nLanguage(next);
          persistLocale(next);
        }
        return next;
      });
    },
    [persistLocale]
  );

  const clearLocaleError = useCallback(() => setLocaleError(null), []);

  return (
    <UiPreferencesContext.Provider
      value={{
        theme,
        resolvedTheme,
        direction,
        locale,
        setTheme,
        toggleTheme,
        setLocale,
        syncLocaleFromServer,
        localeError,
        clearLocaleError,
      }}
    >
      {children}
    </UiPreferencesContext.Provider>
  );
};

export const useUiPreferences = (): UiPreferencesContextType => {
  const ctx = useContext(UiPreferencesContext);
  if (!ctx) {
    throw new Error('useUiPreferences must be used within a UiPreferencesProvider');
  }
  return ctx;
};
