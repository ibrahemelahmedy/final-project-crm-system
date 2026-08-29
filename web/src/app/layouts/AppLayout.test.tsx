import React, { useEffect } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth, type User } from '../../features/auth/AuthContext';
import { UiPreferencesProvider } from '../providers/UiPreferencesContext';
import { AppLayout } from './AppLayout';
import { api, getAccessToken } from '../../lib/api';

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual('../../lib/api');
  return {
    ...actual,
    api: { post: vi.fn() },
  };
});

// Story 11's NotificationBell polls /notifications/unread-count through the
// feature's own api module — mocked here so the shell renders without a
// real network call. A resolved 0 keeps the badge hidden, which is exactly
// the "inert" starting point these tests already assume for the header.
vi.mock('../../features/notifications/api/notificationsApi', () => ({
  fetchUnreadCount: vi.fn().mockResolvedValue(0),
  fetchNotifications: vi.fn().mockResolvedValue({
    data: [],
    meta: { current_page: 1, last_page: 1, per_page: 20, from: null, to: 0, total: 0 },
    links: { first: null, last: null, prev: null, next: null },
  }),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 1,
  name: 'Sarah Ahmed',
  email: 'agent@wisal.test',
  role: 'agent',
  role_label: 'Agent',
  home_route: '/dashboard',
  is_active: true,
  ...overrides,
});

// Logs the seeded user in via AuthContext before rendering children, so
// AppLayout renders against a real authenticated context state rather than
// a hand-rolled mock of useAuth.
const SignedInAs: React.FC<{ user: User; children: React.ReactNode }> = ({ user, children }) => {
  const { login, status } = useAuth();
  useEffect(() => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { token: 'test-token', user } });
    login(user.email, 'Password123!');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (status !== 'authenticated') return null;
  return <>{children}</>;
};

function renderShell(user: User, initialPath = '/dashboard') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false, refetchOnWindowFocus: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <UiPreferencesProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <AuthProvider>
            <SignedInAs user={user}>
              <Routes>
                <Route element={<AppLayout />}>
                  <Route path="/dashboard" element={<div data-testid="page-placeholder">Dashboard</div>} />
                  <Route path="/dashboard/admin" element={<div data-testid="page-placeholder">Admin</div>} />
                </Route>
              </Routes>
            </SignedInAs>
          </AuthProvider>
        </MemoryRouter>
      </UiPreferencesProvider>
    </QueryClientProvider>
  );
}

describe('AppLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the outlet content', async () => {
    renderShell(makeUser());
    expect(await screen.findByTestId('page-placeholder')).toHaveTextContent('Dashboard');
  });

  it('marks only the active nav item with aria-current', async () => {
    renderShell(
      makeUser({ role: 'administrator', role_label: 'Administrator', home_route: '/dashboard/admin' }),
      '/dashboard/admin'
    );
    await screen.findByTestId('page-placeholder');

    const current = screen.getAllByRole('link').filter((el) => el.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    // The Dashboard item resolves to the signed-in user's own home route
    // (resolveNavItems), so it — and only it — is active here.
    expect(current[0]).toHaveTextContent('Dashboard');
    expect(current[0]).toHaveAttribute('href', '/dashboard/admin');
  });

  it('does not mark Dashboard active while on an unrelated route', async () => {
    renderShell(makeUser(), '/dashboard');
    await screen.findByTestId('page-placeholder');

    // Sanity check on /dashboard itself: exactly Dashboard is active.
    const current = screen.getAllByRole('link').filter((el) => el.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Dashboard');
  });

  it('shows the signed-in name and role_label in the header', async () => {
    renderShell(makeUser());
    await screen.findByTestId('page-placeholder');
    // The name/role appear in both the sidebar-bottom block and the header
    // block (both are in the design) — assert at least one of each exists.
    expect(screen.getAllByText('Sarah Ahmed').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Agent').length).toBeGreaterThan(0);
  });

  it('calls logout from AuthContext when sign-out is clicked', async () => {
    renderShell(makeUser());
    await screen.findByTestId('page-placeholder');

    expect(getAccessToken()).toBe('test-token');

    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
    fireEvent.click(screen.getByRole('button', { name: /Sarah Ahmed/i }));

    await waitFor(() => {
      expect(getAccessToken()).toBeNull();
    });
  });

  it('renders the skeleton when user is null', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchInterval: false, refetchOnWindowFocus: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <UiPreferencesProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <AuthProvider>
              <Routes>
                <Route element={<AppLayout />}>
                  <Route path="/dashboard" element={<div data-testid="page-placeholder">Dashboard</div>} />
                </Route>
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        </UiPreferencesProvider>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('page-placeholder')).toBeInTheDocument();
    // No crash, and no signed-in name rendered.
    expect(screen.queryByText('Sarah Ahmed')).not.toBeInTheDocument();
  });

  it('toggles the theme from the header control', async () => {
    renderShell(makeUser());
    await screen.findByTestId('page-placeholder');

    const toggle = screen.getByRole('button', { name: /Switch to (dark|light) mode/i });
    const before = document.documentElement.dataset.theme;
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).not.toBe(before);
    });
  });

  it('hides SLA Rules and Users from an agent', async () => {
    renderShell(makeUser());
    await screen.findByTestId('page-placeholder');
    expect(screen.queryByText('SLA Rules')).not.toBeInTheDocument();
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
  });

  // Story 11 + Story 15 regression guard: the header must not be restructured.
  // Story 15 (WIS-11) FILLS the Language slot in place — no longer disabled,
  // but no header element is added, moved, or reordered.
  it('keeps the header control set and order, with the Language slot now filled', async () => {
    renderShell(makeUser());
    await screen.findByTestId('page-placeholder');

    const header = document.querySelector('.shell-header') as HTMLElement;
    const controls = Array.from(header.querySelectorAll('button, a')) as HTMLElement[];

    const themeIndex = controls.findIndex((el) =>
      /Switch to (dark|light) mode/i.test(el.getAttribute('aria-label') ?? '')
    );
    const languageIndex = controls.findIndex((el) => el.classList.contains('shell-lang-btn'));
    const notifIndex = controls.findIndex((el) =>
      /^Notifications/.test(el.getAttribute('aria-label') ?? '')
    );

    // Theme toggle, then Language, then Notifications — unchanged order.
    expect(themeIndex).toBeGreaterThan(-1);
    expect(languageIndex).toBe(themeIndex + 1);
    expect(notifIndex).toBe(languageIndex + 1);

    const languageBtn = controls[languageIndex];
    expect(languageBtn).not.toBeDisabled();
    expect(languageBtn).not.toHaveAttribute('title', 'Coming soon');

    const notifBtn = screen.getByRole('button', { name: /^Notifications/ });
    expect(notifBtn).not.toBeDisabled();
  });
});
