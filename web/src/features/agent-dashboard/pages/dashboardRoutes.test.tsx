import React, { useEffect } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth, type User } from '../../auth/AuthContext';
import { RequireAuth } from '../../auth/RequireAuth';
import { AgentDashboardPage, TeamDashboardPage, AdminDashboardPage } from '../index';
import { api } from '../../../lib/api';

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api');
  return { ...actual, api: { post: vi.fn(), get: vi.fn() } };
});

const users: Record<string, User> = {
  agent: { id: 1, name: 'Sarah Ahmed', email: 'agent@wisal.test', role: 'agent', role_label: 'Agent', home_route: '/dashboard', is_active: true },
  team_lead: { id: 2, name: 'Mona Zaki', email: 'lead@wisal.test', role: 'team_lead', role_label: 'Team Lead', home_route: '/dashboard/team', is_active: true },
  administrator: { id: 3, name: 'System Admin', email: 'admin@wisal.test', role: 'administrator', role_label: 'Administrator', home_route: '/dashboard/admin', is_active: true },
};

const SignedIn: React.FC<{ user: User; children: React.ReactNode }> = ({ user, children }) => {
  const { login, status } = useAuth();
  useEffect(() => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { token: 't', user } });
    login(user.email, 'x');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (status !== 'authenticated') return null;
  return <>{children}</>;
};

function renderAt(path: string, user: User) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <SignedIn user={user}>
            <Routes>
              <Route path="/dashboard" element={<AgentDashboardPage />} />
              <Route
                path="/dashboard/team"
                element={
                  <RequireAuth roles={['team_lead', 'administrator']}>
                    <TeamDashboardPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/dashboard/admin"
                element={
                  <RequireAuth roles={['administrator']}>
                    <AdminDashboardPage />
                  </RequireAuth>
                }
              />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </SignedIn>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('dashboard routes per role', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.endsWith('/workload')) return Promise.resolve({ data: [] });
      if (url.endsWith('/summary')) {
        return Promise.resolve({
          data: {
            assigned_count: 0, sla_risk_count: 0, resolved_today_count: 0,
            team_name: 'Support Ops', agent_count: 0, open_count: 0, escalation_count: 0, sla_compliance_pct: null,
            user_count: 0, active_sla_rule_count: 0, audit_log_count: 0,
          },
        });
      }
      return Promise.resolve({ data: { data: [] } });
    });
  });

  it('sends each role to its own home page', async () => {
    renderAt('/dashboard', users.agent);
    expect(await screen.findByRole('heading', { name: /Sarah/ })).toBeInTheDocument();

    renderAt('/dashboard/team', users.team_lead);
    expect(await screen.findByRole('heading', { name: 'Team overview' })).toBeInTheDocument();

    renderAt('/dashboard/admin', users.administrator);
    expect(await screen.findByRole('heading', { name: 'Admin overview' })).toBeInTheDocument();
  });

  it('refuses a Team Lead the admin dashboard', async () => {
    renderAt('/dashboard/admin', users.team_lead);
    expect(await screen.findByText(/Access Denied/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Admin overview' })).not.toBeInTheDocument();
  });
});
