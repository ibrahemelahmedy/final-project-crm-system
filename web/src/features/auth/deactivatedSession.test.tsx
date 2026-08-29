import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { RequireAuth } from './RequireAuth';
import { api } from '../../lib/api';

/**
 * Story 08's mid-session deactivation path, driven through the real shared
 * Axios instance's own adapter.
 *
 * Deactivating a signed-in user revokes ALL their tokens in the same
 * transaction, so their next request — from whatever screen they are on —
 * returns 401. The SPA must sign them out cleanly and route to /login rather
 * than leave them on a screen whose every request fails.
 *
 * Swapping `api.defaults.adapter` rather than mocking the module keeps the
 * interceptor under test: a vi.mock of lib/api would replace the very code
 * this asserts.
 */
type Reply = { status: number; data: unknown };

const replies = new Map<string, Reply>();

function stub(url: string, reply: Reply) {
  replies.set(url, reply);
}

const loginUser = {
  id: 1,
  name: 'Tom Becker',
  email: 'agent@wisal.test',
  role: 'agent' as const,
  role_label: 'Agent',
  home_route: '/dashboard',
  is_active: true,
};

const Protected: React.FC = () => {
  const { user } = useAuth();
  return (
    <div>
      <span>Signed in as {user?.name}</span>
      <button type="button" onClick={() => void api.get('/admin/users').catch(() => {})}>
        Trigger request
      </button>
    </div>
  );
};

// Signs in once on mount, then renders its children forever.
//
// The `signedInOnce` latch matters in both directions: it holds the routes back
// until the first sign-in resolves (or RequireAuth redirects to /login before
// the token ever lands), and it never flips back — so once the 401 clears the
// auth state, RequireAuth gets its chance to redirect, which is the behaviour
// under test.
const SignsInOnce: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { login } = useAuth();
  const [signedInOnce, setSignedInOnce] = React.useState(false);

  React.useEffect(() => {
    login('agent@wisal.test', 'Password123!')
      .catch(() => {})
      .finally(() => setSignedInOnce(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!signedInOnce) return null;
  return <>{children}</>;
};

const LoginStub: React.FC = () => {
  const { sessionEndedReason } = useAuth();
  return (
    <div>
      <span>Login screen</span>
      {sessionEndedReason && <span role="alert">{sessionEndedReason}</span>}
    </div>
  );
};

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <AuthProvider>
        <SignsInOnce>
          <Routes>
            <Route path="/login" element={<LoginStub />} />
            <Route
              path="/protected"
              element={
                <RequireAuth>
                  <Protected />
                </RequireAuth>
              }
            />
          </Routes>
        </SignsInOnce>
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  replies.clear();
  stub('/login', { status: 200, data: { token: 'valid-token', user: loginUser } });

  api.defaults.adapter = vi.fn(async (config) => {
    const reply = replies.get(config.url ?? '') ?? { status: 404, data: {} };
    const response = {
      data: reply.data,
      status: reply.status,
      statusText: String(reply.status),
      headers: {},
      config,
    };
    if (reply.status >= 400) {
      const error = Object.assign(new Error(`Request failed with status code ${reply.status}`), {
        isAxiosError: true,
        config,
        response,
        toJSON: () => ({}),
      });
      throw error;
    }
    return response as never;
  }) as never;
});

describe('a signed-in user deactivated mid-session', () => {
  it('is signed out and routed to /login when their next request 401s', async () => {
    stub('/admin/users', {
      status: 401,
      data: { message: 'This account has been deactivated. Contact your administrator.' },
    });

    renderApp();

    await screen.findByText('Signed in as Tom Becker');
    screen.getByRole('button', { name: 'Trigger request' }).click();

    // Cleanly signed out and moved to /login — not left on a broken screen.
    await screen.findByText('Login screen');
    expect(screen.queryByText('Signed in as Tom Becker')).not.toBeInTheDocument();
  });

  it('explains WHY the session ended, using the servers own message', async () => {
    stub('/admin/users', {
      status: 401,
      data: { message: 'This account has been deactivated. Contact your administrator.' },
    });

    renderApp();

    await screen.findByText('Signed in as Tom Becker');
    screen.getByRole('button', { name: 'Trigger request' }).click();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('This account has been deactivated. Contact your administrator.');
  });

  it('falls back to a generic reason when the 401 carries no message', async () => {
    stub('/admin/users', { status: 401, data: {} });

    renderApp();

    await screen.findByText('Signed in as Tom Becker');
    screen.getByRole('button', { name: 'Trigger request' }).click();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Your session has ended. Sign in again.');
  });

  it('leaves a 403 alone — a role the endpoint refuses is not an ended session', async () => {
    stub('/admin/users', { status: 403, data: { message: 'This action requires an Administrator role.' } });

    renderApp();

    await screen.findByText('Signed in as Tom Becker');
    screen.getByRole('button', { name: 'Trigger request' }).click();

    // Still signed in; a 403 is an authorization answer, not an expired token.
    await waitFor(() => expect(screen.getByText('Signed in as Tom Becker')).toBeInTheDocument());
    expect(screen.queryByText('Login screen')).not.toBeInTheDocument();
  });

  it('does NOT fire the sign-out path for a failed login attempt', async () => {
    // A 401 on /login is a bad credential, not an expired session. Firing the
    // sign-out path there would fight LoginPage's own error rendering.
    stub('/login', { status: 401, data: { message: 'These credentials do not match our records.' } });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginStub />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await screen.findByText('Login screen');
    await api.post('/login', {}).catch(() => {});

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});
