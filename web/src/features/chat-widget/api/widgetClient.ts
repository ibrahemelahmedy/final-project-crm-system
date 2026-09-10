import axios from 'axios';

/**
 * Story 26 (WIS-22), Decision 10. A SECOND, documented axios instance.
 *
 * `web/src/lib/api.ts:30-35` builds the shared `api` instance from an
 * ABSOLUTE `VITE_API_URL` base, and its own comment at `:42-47` warns that
 * "any axios/fetch call made OUTSIDE this instance bypasses" its
 * Accept-Language interceptor. `widgetClient` is a deliberate exception, not
 * an oversight, because it cannot satisfy that rule the way every other
 * feature does:
 *
 * `WidgetChatPage` is loaded, via `web/public/widget.js`, as an IFRAME on a
 * third-party page the widget owner controls, not on Wisal's own origin.
 * Pointing it at the absolute API host would need a CORS exception in
 * `api/config/cors.php` — which Decision 10 explicitly refuses to add, since
 * `config/cors.php` stays byte-unchanged. Instead the iframe document itself
 * is served from the Wisal SPA origin, and `web/vercel.json` already
 * rewrites `/api/(.*)` to the API host with NO header changes — so a
 * RELATIVE `/api` base reaches the same backend, same-origin, through that
 * proxy (and through `web/vite.config.ts`'s `server.proxy` in dev). Zero
 * CORS involvement, zero CSP exception.
 *
 * Everything else about the shared instance is deliberately NOT brought
 * along: no `Authorization` bearer (the widget's own session token is held
 * in a module-scoped variable inside `WidgetChatPage`, sent by hand per
 * request — never `localStorage`, and never mixed with the staff token), and
 * no 401 handler (a widget 401 means the chat session died, not that a staff
 * member was signed out).
 */
export const widgetClient = axios.create({
  baseURL: '/api',
  headers: {
    Accept: 'application/json',
  },
});

// Story 15 (WIS-11), decision 3, re-registered here rather than imported —
// see the docblock above for why this instance cannot just wrap `api`. Same
// behaviour: the client is the authority on locale, sourced from the same
// stored preference key `UiPreferencesContext` writes.
widgetClient.interceptors.request.use((config) => {
  let locale = 'en';
  try {
    if (localStorage.getItem('wisal-lang') === 'ar') locale = 'ar';
  } catch {
    // Third-party pages can block storage access entirely; default to 'en'.
  }
  config.headers['Accept-Language'] = locale;

  return config;
});
