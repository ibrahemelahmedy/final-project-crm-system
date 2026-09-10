import { describe, it, expect, beforeEach } from 'vitest';
import { widgetClient } from './widgetClient';

/**
 * Story 26 (WIS-22), Test Plan Q.95. Decision 10's documented exception is
 * ENFORCED here, not just trusted: the base URL must stay the RELATIVE
 * `/api` (so the same-origin proxy applies from a third-party embed), and
 * the shared `Accept-Language` interceptor contract must hold too.
 */
describe('widgetClient', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
  });

  it('uses the relative /api base URL, never an absolute one', () => {
    expect(widgetClient.defaults.baseURL).toBe('/api');
  });

  it('sends Accept-Language: en by default', async () => {
    const config = await widgetClient.interceptors.request.handlers![0].fulfilled({
      headers: {},
    } as never);
    expect(config.headers['Accept-Language']).toBe('en');
  });

  it('sends Accept-Language: ar when wisal-lang is stored as ar', async () => {
    localStorage.setItem('wisal-lang', 'ar');
    const config = await widgetClient.interceptors.request.handlers![0].fulfilled({
      headers: {},
    } as never);
    expect(config.headers['Accept-Language']).toBe('ar');
  });
});
