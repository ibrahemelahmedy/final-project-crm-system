import React, { useEffect } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth, type User } from '../../features/auth/AuthContext';
import { UiPreferencesProvider } from '../providers/UiPreferencesContext';
import { AppLayout } from './AppLayout';
import { api } from '../../lib/api';
import i18n from '../../i18n/instance';

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual('../../lib/api');
  return {
    ...actual,
    api: { post: vi.fn(), patch: vi.fn().mockResolvedValue({ data: {} }) },
  };
});

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

const makeUser = (o: Partial<User> = {}): User => ({
  id: 1,
  name: 'Sarah Ahmed',
  email: 'agent@wisal.test',
  role: 'agent',
  role_label: 'Agent',
  home_route: '/dashboard',
  is_active: true,
  locale: 'en',
  ...o,
});

const SignedInAs: React.FC<{ user: User; children: React.ReactNode }> = ({ user, children }) => {
  const { login, status } = useAuth();
  useEffect(() => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { token: 't', user } });
    login(user.email, 'pw');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (status !== 'authenticated') return null;
  return <>{children}</>;
};

const LocationProbe: React.FC = () => {
  const loc = useLocation();
  return <div data-testid="pathname">{loc.pathname}</div>;
};

function renderShell() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <UiPreferencesProvider>
        <MemoryRouter initialEntries={['/tickets']}>
          <AuthProvider>
            <SignedInAs user={makeUser()}>
              <Routes>
                <Route element={<AppLayout />}>
                  <Route
                    path="/tickets"
                    element={
                      <>
                        <LocationProbe />
                        <label htmlFor="draft">Draft</label>
                        <input id="draft" aria-label="draft" />
                      </>
                    }
                  />
                </Route>
              </Routes>
            </SignedInAs>
          </AuthProvider>
        </MemoryRouter>
      </UiPreferencesProvider>
    </QueryClientProvider>
  );
}

describe('AppLayout — language switcher (WIS-11)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    await i18n.changeLanguage('en');
  });
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('has an enabled language control that switches nav labels to Arabic while keeping the route and unsaved form state', async () => {
    renderShell();
    await screen.findByTestId('pathname');

    // Nav renders in English first.
    expect(screen.getByRole('link', { name: 'Tickets' })).toBeInTheDocument();

    // Type into an unsaved form field.
    const input = screen.getByLabelText('draft') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'half-written reply' } });

    const langBtn = document.querySelector('.shell-lang-btn') as HTMLButtonElement;
    expect(langBtn).not.toBeDisabled();

    fireEvent.click(langBtn);

    // Nav labels are now Arabic.
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'التذاكر' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('link', { name: 'Tickets' })).not.toBeInTheDocument();

    // Route unchanged.
    expect(screen.getByTestId('pathname')).toHaveTextContent('/tickets');

    // Unsaved text survives — no remount.
    expect((screen.getByLabelText('draft') as HTMLInputElement).value).toBe('half-written reply');

    // Persisted server-side.
    expect(api.patch).toHaveBeenCalledWith('/user/preferences', { locale: 'ar' });
    expect(document.documentElement).toHaveAttribute('lang', 'ar');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
  });
});
