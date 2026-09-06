import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { AxiosAdapter } from 'axios';
import {
  portalClient,
  getPortalToken,
  setPortalToken,
  setPortalUnauthorizedHandler,
} from './portalClient';
import { api as staffApi, setAccessToken } from '../../../lib/api';

/**
 * Test 24 — the portal Axios instance carries the PORTAL identity and never the
 * staff one, sends Accept-Language, and a 401 does not fire the staff sign-out.
 */
describe('portalClient', () => {
  let seen: Parameters<AxiosAdapter>[0] | null;
  const realAdapter = portalClient.defaults.adapter;

  beforeEach(() => {
    seen = null;
    setPortalToken(null);
    setPortalUnauthorizedHandler(null);
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    portalClient.defaults.adapter = ((config) => {
      seen = config;
      return Promise.resolve({
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      });
    }) as AxiosAdapter;
  });

  afterEach(() => {
    portalClient.defaults.adapter = realAdapter;
    setPortalToken(null);
  });

  it('attaches the portal token, never the staff bearer', async () => {
    setPortalToken('portal-abc');
    await portalClient.get('/portal/me');
    expect(seen?.headers?.Authorization).toBe('Bearer portal-abc');
  });

  it('sends no Authorization header when there is no portal token', async () => {
    await portalClient.get('/portal/faq');
    expect(seen?.headers?.Authorization).toBeUndefined();
  });

  it('sends Accept-Language from wisal-lang', async () => {
    localStorage.setItem('wisal-lang', 'ar');
    await portalClient.get('/portal/faq');
    expect(seen?.headers?.['Accept-Language']).toBe('ar');
  });

  it('defaults Accept-Language to en', async () => {
    await portalClient.get('/portal/faq');
    expect(seen?.headers?.['Accept-Language']).toBe('en');
  });

  it('is a separate instance and ignores the staff bearer token entirely', async () => {
    expect(portalClient).not.toBe(staffApi);
    setAccessToken('staff-token-should-never-leak');
    await portalClient.get('/portal/faq');
    expect(seen?.headers?.Authorization).toBeUndefined();
    setAccessToken(null);
  });

  it('clears the portal token and calls only the portal 401 handler on a 401', async () => {
    setPortalToken('portal-abc');
    const portalHandler = vi.fn();
    setPortalUnauthorizedHandler(portalHandler);

    portalClient.defaults.adapter = ((config) =>
      Promise.reject(
        Object.assign(new Error('unauth'), {
          isAxiosError: true,
          config,
          response: { status: 401, data: {}, statusText: 'Unauthorized', headers: {}, config },
        })
      )) as AxiosAdapter;

    await expect(portalClient.get('/portal/requests')).rejects.toBeTruthy();

    expect(portalHandler).toHaveBeenCalledTimes(1);
    expect(getPortalToken()).toBeNull();
  });

  it('leaves the token in place on a 401 from the access endpoints', async () => {
    setPortalToken('portal-abc');
    portalClient.defaults.adapter = ((config) =>
      Promise.reject(
        Object.assign(new Error('unauth'), {
          isAxiosError: true,
          config,
          response: { status: 401, data: {}, statusText: 'Unauthorized', headers: {}, config },
        })
      )) as AxiosAdapter;

    await expect(
      portalClient.post('/portal/access/verify', { identifier: 'x', code: '000000' })
    ).rejects.toBeTruthy();

    expect(getPortalToken()).toBe('portal-abc');
  });
});
