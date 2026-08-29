import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UiPreferencesProvider, useUiPreferences } from './UiPreferencesContext';
import { api } from '../../lib/api';

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual('../../lib/api');
  return { ...actual, api: { patch: vi.fn().mockResolvedValue({ data: {} }) } };
});

function mockMatchMedia(matches: boolean) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = [];
  const mql = {
    matches,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.push(cb),
    removeEventListener: vi.fn(),
    dispatchEvent: () => false,
  };
  window.matchMedia = vi.fn().mockReturnValue(mql);
  return {
    fire: (next: boolean) => {
      mql.matches = next;
      listeners.forEach((cb) => cb({ matches: next } as MediaQueryListEvent));
    },
  };
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <UiPreferencesProvider>{children}</UiPreferencesProvider>
);

describe('UiPreferencesContext', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('follows prefers-color-scheme when no choice was ever made', () => {
    mockMatchMedia(true);

    const { result } = renderHook(() => useUiPreferences(), { wrapper });

    expect(result.current.resolvedTheme).toBe('dark');
    // No write happened just because the app resolved a theme on mount.
    expect(localStorage.length).toBe(0);
  });

  it('persists an explicit choice and overrides the OS', () => {
    mockMatchMedia(true);

    const { result } = renderHook(() => useUiPreferences(), { wrapper });

    act(() => {
      result.current.setTheme('light');
    });

    expect(result.current.resolvedTheme).toBe('light');
    expect(localStorage.getItem('wisal-theme')).toBe('light');
  });

  it('survives a throwing localStorage', () => {
    mockMatchMedia(false);
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('blocked');
    };

    const { result } = renderHook(() => useUiPreferences(), { wrapper });

    expect(() => {
      act(() => {
        result.current.toggleTheme();
      });
    }).not.toThrow();

    expect(result.current.resolvedTheme).toBe('dark');

    Storage.prototype.setItem = original;
  });

  // ---- Story 15 (WIS-11): locale ----------------------------------------

  it('writes nothing to localStorage on mount when no choice was ever made', () => {
    mockMatchMedia(false);
    renderHook(() => useUiPreferences(), { wrapper });
    // Story 02's assertion still holds after the locale extension.
    expect(localStorage.length).toBe(0);
  });

  it('setLocale("ar") sets <html lang> and <html dir>, persists wisal-lang=ar, and PATCHes', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useUiPreferences(), { wrapper });

    act(() => {
      result.current.setLocale('ar');
    });

    expect(result.current.locale).toBe('ar');
    expect(result.current.direction).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(localStorage.getItem('wisal-lang')).toBe('ar');
    expect(api.patch).toHaveBeenCalledWith('/user/preferences', { locale: 'ar' });
  });

  it('derives direction from locale — there is no setDirection', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useUiPreferences(), { wrapper });
    expect((result.current as Record<string, unknown>).setDirection).toBeUndefined();

    act(() => result.current.setLocale('ar'));
    expect(result.current.direction).toBe('rtl');
    act(() => result.current.setLocale('en'));
    expect(result.current.direction).toBe('ltr');
  });

  it('syncLocaleFromServer reconciles without issuing a PATCH', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useUiPreferences(), { wrapper });
    (api.patch as ReturnType<typeof vi.fn>).mockClear();

    act(() => {
      result.current.syncLocaleFromServer('ar');
    });

    expect(result.current.locale).toBe('ar');
    expect(localStorage.getItem('wisal-lang')).toBe('ar');
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('reacts to an OS theme change while on system', () => {
    const media = mockMatchMedia(false);

    const { result } = renderHook(() => useUiPreferences(), { wrapper });

    expect(result.current.resolvedTheme).toBe('light');

    act(() => {
      media.fire(true);
    });

    expect(result.current.resolvedTheme).toBe('dark');
  });
});
