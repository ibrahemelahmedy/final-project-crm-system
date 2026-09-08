import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from './i18n/instance';
import { AuthProvider, useAuth, type User } from './features/auth/AuthContext';
import { api } from './lib/api';
import { UsersPage } from './features/users-roles-admin/pages/UsersPage';
import * as adminApi from './features/users-roles-admin/api/adminApi';
import type { AdminUser, Paginated, UserFacets } from './features/users-roles-admin/model/adminUser';

vi.mock('./lib/api', async () => {
  const actual = await vi.importActual('./lib/api');
  return { ...actual, api: { post: vi.fn() } };
});
vi.mock('./features/users-roles-admin/api/adminApi');

const CHROME_STRINGS_EN = [
  'Users', 'internal users', 'across', 'departments', 'Audit Log', 'Settings',
  'Invite User', 'Role', 'Department', 'Status', 'Search users', 'No users match',
  'Reset filters', 'No users yet', 'USER', 'EMAIL', 'ROLE', 'STATUS', 'DEPARTMENT',
  'LAST ACTIVE', 'ACTIONS', 'Active', 'Inactive', 'Edit', 'Deactivate', 'Activate',
];

const makeUser = (overrides: Partial<AdminUser> = {}): AdminUser => ({
  id: 1, name: 'Sarah Ahmed', email: 'sarah.ahmed@wisal.io', role: 'team_lead',
  role_label: 'Team Lead', home_route: '/dashboard/team', is_active: true,
  department: 'Support Ops', initials: 'SA', last_login_at: new Date().toISOString(),
  ...overrides,
});

const facets: UserFacets = {
  roles: [{ value: 'agent', label: 'Agent', count: 9 }],
  departments: [{ value: 'Support Ops', count: 5 }],
  total: 14, active_total: 13, department_total: 4,
};

function makePage(data: AdminUser[]): Paginated<AdminUser> {
  return { data, meta: { current_page: 1, last_page: 1, per_page: 25, total: data.length } };
}

const adminUser: User = {
  id: 99, name: 'System Admin', email: 'admin@wisal.test', role: 'administrator',
  role_label: 'Administrator', home_route: '/dashboard/admin', is_active: true,
};

const SignedInAs: React.FC<{ user: User; children: React.ReactNode }> = ({ user, children }) => {
  const { login, status } = useAuth();
  React.useEffect(() => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { token: 't', user } });
    login(user.email, 'Password123!');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (status !== 'authenticated') return null;
  return <>{children}</>;
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/users']}>
        <AuthProvider>
          <SignedInAs user={adminUser}>
            <Routes>
              <Route path="/users" element={<UsersPage />} />
            </Routes>
          </SignedInAs>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('Users — Arabic chrome sweep', () => {
  it('renders no English chrome string under ar (populated table)', async () => {
    await i18n.changeLanguage('ar');
    (adminApi.getUserFacets as ReturnType<typeof vi.fn>).mockResolvedValue(facets);
    (adminApi.listUsers as ReturnType<typeof vi.fn>).mockResolvedValue(makePage([makeUser()]));
    renderPage();
    await waitFor(() => expect((document.body.textContent ?? '').length).toBeGreaterThan(20));
    const body = document.body.textContent ?? '';
    const hits = CHROME_STRINGS_EN.filter((s) => body.includes(s));
    expect(hits, `English chrome leaked under ar: ${hits.join(', ')}`).toEqual([]);
  });

  it('renders no English chrome string under ar (empty state)', async () => {
    await i18n.changeLanguage('ar');
    (adminApi.getUserFacets as ReturnType<typeof vi.fn>).mockResolvedValue(facets);
    (adminApi.listUsers as ReturnType<typeof vi.fn>).mockResolvedValue(makePage([]));
    renderPage();
    await waitFor(() => expect((document.body.textContent ?? '').length).toBeGreaterThan(20));
    const body = document.body.textContent ?? '';
    const hits = CHROME_STRINGS_EN.filter((s) => body.includes(s));
    expect(hits, `English chrome leaked under ar: ${hits.join(', ')}`).toEqual([]);
  });
});
