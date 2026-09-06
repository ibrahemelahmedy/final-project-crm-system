import axios from 'axios';

// Story 17 (WIS-16) — a SEPARATE, portal-only Axios instance. It deliberately
// does NOT import web/src/lib/api.ts: that instance attaches the staff
// bearer token and registers a 401 -> sign-out interceptor for the STAFF
// session. Sending a staff identity from a customer's browser (or firing the
// staff sign-out path on a portal 401) is the exact confusion this story
// exists to avoid — see web/src/features/csat/api/csatPublicClient.ts for
// the same pattern applied to the public CSAT page.
const TOKEN_KEY = 'wisal-portal-token';

// A module-scoped mirror so the tab keeps working even when sessionStorage
// is blocked (private mode) — every read/write below is wrapped in try/catch.
let tokenMirror: string | null = null;

export function getPortalToken(): string | null {
  if (tokenMirror !== null) return tokenMirror;
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setPortalToken(token: string | null): void {
  tokenMirror = token;
  try {
    if (token === null) sessionStorage.removeItem(TOKEN_KEY);
    else sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage blocked — the mirror above is the fallback for this tab.
  }
}

type UnauthorizedHandler = () => void;
let onPortalUnauthorized: UnauthorizedHandler | null = null;

export const setPortalUnauthorizedHandler = (handler: UnauthorizedHandler | null) => {
  onPortalUnauthorized = handler;
};

export const portalClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  headers: { Accept: 'application/json' },
});

portalClient.interceptors.request.use((config) => {
  const token = getPortalToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Same locale-detection rule as the rest of the app: the client is the
  // authority. The portal has no signed-in user, so this reads the same
  // `wisal-lang` key the header toggle writes — never a server preference.
  let locale = 'en';
  try {
    if (localStorage.getItem('wisal-lang') === 'ar') locale = 'ar';
  } catch {}
  config.headers['Accept-Language'] = locale;

  return config;
});

portalClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    const isAccessRequest = error?.config?.url?.includes('/portal/access/');

    if (status === 401 && !isAccessRequest) {
      setPortalToken(null);
      onPortalUnauthorized?.();
    }

    return Promise.reject(error);
  }
);
