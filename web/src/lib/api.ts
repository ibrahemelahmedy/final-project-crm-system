import axios from 'axios';

// The token is held in a module-scoped variable, NOT localStorage or
// sessionStorage — see docs/decisions/ADR-004-authentication.md.
// Consequence: a page reload logs the user out. That is intended.
let accessToken: string | null = null;

export const setAccessToken = (t: string | null) => {
  accessToken = t;
};

export const getAccessToken = () => accessToken;

// Story 08: a signed-in user can now be deactivated mid-session, and their
// very next request returns 401 rather than failing at their next login. The
// SPA has to handle that from ANY screen, so the handler is registered once
// here rather than per-feature.
//
// AuthContext owns the auth state and the query cache, so it registers the
// actual clear-and-redirect through this hook rather than being imported here
// — importing AuthContext from lib/api would be a cycle.
type UnauthorizedHandler = (message: string | null) => void;

let onUnauthorized: UnauthorizedHandler | null = null;

export const setUnauthorizedHandler = (handler: UnauthorizedHandler | null) => {
  onUnauthorized = handler;
};

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  headers: {
    Accept: 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  // Story 15 (WIS-11), decision 3: the client is the authority on the user's
  // locale. Every request carries it explicitly, sourced from the stored
  // preference `UiPreferencesContext` writes on each switch — so the server
  // echoes validation messages back in the language the user chose. Any
  // `axios`/`fetch` call made OUTSIDE this instance bypasses this and must be
  // routed through `api`.
  let locale = 'en';
  try {
    if (localStorage.getItem('wisal-lang') === 'ar') locale = 'ar';
  } catch {}
  config.headers['Accept-Language'] = locale;

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;

    // A 401 on /login is a failed sign-in attempt, not an expired session —
    // firing the sign-out path there would clear a state that was never set
    // and fight LoginPage's own error rendering.
    const isLoginRequest = error?.config?.url?.includes('/login');

    if (status === 401 && !isLoginRequest && accessToken !== null) {
      // The message carries WHY — a deactivated account says so, so the login
      // screen can explain rather than looking like a random logout.
      const message =
        (axios.isAxiosError(error) && (error.response?.data as { message?: string } | undefined)?.message) ||
        null;
      onUnauthorized?.(message);
    }

    return Promise.reject(error);
  }
);
