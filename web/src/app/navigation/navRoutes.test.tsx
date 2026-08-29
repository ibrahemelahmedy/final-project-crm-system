import React, { useEffect } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth, type User } from '../../features/auth/AuthContext';
import { RequireAuth } from '../../features/auth/RequireAuth';
import { UiPreferencesProvider } from '../providers/UiPreferencesContext';
import { AppLayout } from '../layouts/AppLayout';
import { PagePlaceholder } from '../components/PagePlaceholder';
import { navItems } from './navItems';
import { api } from '../../lib/api';

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual('../../lib/api');
  return {
    ...actual,
    api: { post: vi.fn() },
  };
});

// AppLayout now renders Story 11's NotificationBell, which polls through
// this module — mocked so every route in this manifest sweep renders without
// a real network call.
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

const adminUser: User = {
  id: 4,
  name: 'Admin User',
  email: 'admin@wisal.test',
  role: 'administrator',
  role_label: 'Administrator',
  home_route: '/dashboard/admin',
  is_active: true,
};

const SignedIn: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { login, status } = useAuth();
  useEffect(() => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { token: 't', user: adminUser } });
    login(adminUser.email, 'Password123!');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (status !== 'authenticated') return null;
  return <>{children}</>;
};

function renderAt(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false, refetchOnWindowFocus: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <UiPreferencesProvider>
        <MemoryRouter initialEntries={[path]}>
          <AuthProvider>
            <SignedIn>
              <Routes>
                <Route
                  element={
                    <RequireAuth>
                      <AppLayout />
                    </RequireAuth>
                  }
                >
                  {navItems.map((item) => (
                    <Route key={item.to} path={item.to} element={<PagePlaceholder titleKey={item.labelKey} />} />
                  ))}
                </Route>
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </SignedIn>
          </AuthProvider>
        </MemoryRouter>
      </UiPreferencesProvider>
    </QueryClientProvider>
  );
}

describe('nav routes resolve for every manifest entry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(navItems)('$to renders its own placeholder, not the catch-all redirect', async (item) => {
    renderAt(item.to);
    const placeholder = await screen.findByTestId('page-placeholder');
    expect(placeholder).toHaveTextContent(item.label);
  });
});
