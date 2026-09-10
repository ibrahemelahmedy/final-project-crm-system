import { widgetClient } from './widgetClient';

/**
 * Story 26 (WIS-22), Decision 11. The `chat_sessions` bearer token, held in a
 * MODULE-SCOPED VARIABLE — never `localStorage` or `sessionStorage`. This is
 * the same decision `web/src/lib/api.ts:3-6` records for the staff access
 * token, and here it carries a second reason: the iframe document can be
 * reused by a shared device (a kiosk, a shared browser profile) across
 * different visitors, and a token surviving in storage would let the next
 * visitor's tab silently resume a stranger's conversation. A page reload —
 * or a fresh iframe — always starts a new session.
 */
let sessionToken: string | null = null;

export function setWidgetSessionToken(token: string | null) {
  sessionToken = token;
}

export function getWidgetSessionToken() {
  return sessionToken;
}

widgetClient.interceptors.request.use((config) => {
  if (sessionToken) {
    config.headers.Authorization = `Bearer ${sessionToken}`;
  }
  return config;
});
