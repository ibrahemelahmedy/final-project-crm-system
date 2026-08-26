import React, { useEffect } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
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
  return render(
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
                  <Route key={item.to} path={item.to} element={<PagePlaceholder title={item.label} />} />
                ))}
              </Route>
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </SignedIn>
        </AuthProvider>
      </MemoryRouter>
    </UiPreferencesProvider>
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
