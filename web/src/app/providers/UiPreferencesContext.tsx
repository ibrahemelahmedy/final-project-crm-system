import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type Theme = 'system' | 'light' | 'dark';
export type Direction = 'ltr' | 'rtl';

type UiPreferencesContextType = {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  direction: Direction;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setDirection: (d: Direction) => void;
};

const UiPreferencesContext = createContext<UiPreferencesContextType | undefined>(undefined);

function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem('wisal-theme') as Theme | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {}
  return 'system';
}

function getInitialDirection(): Direction {
  try {
    const saved = localStorage.getItem('wisal-lang');
    if (saved === 'ar') return 'rtl';
  } catch {}
  return 'ltr';
}

function getSystemPrefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export const UiPreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const [direction, setDirectionState] = useState<Direction>(getInitialDirection);
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(getSystemPrefersDark);

  // Follow the OS theme live while theme === 'system' — a one-time sample
  // (what LoginPage did before this provider existed) misses a change made
  // while the app stays open.
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
  // included) sees the same theme and direction.
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    document.documentElement.dir = direction;
  }, [direction]);

  // Persisted ONLY here, on an explicit call — never on mount/render, or the
  // OS-follows default would freeze into a permanent explicit choice the
  // user never made.
  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem('wisal-theme', next);
    } catch {}
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  const setDirection = useCallback((next: Direction) => {
    setDirectionState(next);
    try {
      // Same storage key LoginPage used before this provider existed —
      // 'ar'/'en', not 'rtl'/'ltr' — so an existing saved preference keeps
      // meaning the same thing.
      localStorage.setItem('wisal-lang', next === 'rtl' ? 'ar' : 'en');
    } catch {}
  }, []);

  return (
    <UiPreferencesContext.Provider
      value={{ theme, resolvedTheme, direction, setTheme, toggleTheme, setDirection }}
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
