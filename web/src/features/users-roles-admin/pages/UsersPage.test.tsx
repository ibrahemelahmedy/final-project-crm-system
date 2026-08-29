import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth, type User } from '../../auth/AuthContext';
import { api } from '../../../lib/api';
import { UsersPage } from './UsersPage';
import * as adminApi from '../api/adminApi';
import type { AdminUser, Paginated, UserFacets } from '../model/adminUser';

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api');
  return { ...actual, api: { post: vi.fn() } };
});

vi.mock('../api/adminApi');

const makeUser = (overrides: Partial<AdminUser> = {}): AdminUser => ({
  id: 1,
  name: 'Sarah Ahmed',
  email: 'sarah.ahmed@wisal.io',
  role: 'team_lead',
  role_label: 'Team Lead',
  home_route: '/dashboard/team',
  is_active: true,
  department: 'Support Ops',
  initials: 'SA',
  last_login_at: new Date().toISOString(),
  ...overrides,
});

const facets: UserFacets = {
  roles: [
    { value: 'agent', label: 'Agent', count: 9 },
    { value: 'team_lead', label: 'Team Lead', count: 3 },
    { value: 'administrator', label: 'Administrator', count: 2 },
  ],
  departments: [
    { value: 'Billing Support', count: 3 },
    { value: 'Platform', count: 2 },
    { value: 'Support Ops', count: 5 },
    { value: 'Technical Support', count: 4 },
  ],
  total: 14,
  active_total: 13,
  department_total: 4,
};

function makePage(data: AdminUser[], overrides: Partial<Paginated<AdminUser>['meta']> = {}): Paginated<AdminUser> {
  return {
    data,
    meta: { current_page: 1, last_page: 1, per_page: 25, total: data.length, ...overrides },
  };
}

const adminUser: User = {
  id: 99,
  name: 'System Admin',
  email: 'admin@wisal.test',
  role: 'administrator',
  role_label: 'Administrator',
  home_route: '/dashboard/admin',
  is_active: true,
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

const LocationProbe: React.FC = () => {
  const location = useLocation();
  return <div data-testid="location">{location.search}</div>;
};

function renderPage(initialEntries: string[] = ['/users']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <AuthProvider>
          <SignedInAs user={adminUser}>
            <Routes>
              <Route
                path="/users"
                element={
                  <>
                    <UsersPage />
                    <LocationProbe />
                  </>
                }
              />
            </Routes>
          </SignedInAs>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(adminApi.getUserFacets).mockResolvedValue(facets);
});

describe('UsersPage', () => {
  it('renders the six design columns in the design order, plus row actions', async () => {
    vi.mocked(adminApi.listUsers).mockResolvedValue(makePage([makeUser()]));

    renderPage();

    await screen.findByRole('table', { name: 'Users' });

    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent?.trim());

    // The six columns from WisalUsers-LightLTR.dc.html, in order.
    expect(headers).toEqual([
      '',
      'USER',
      'EMAIL',
      'ROLE',
      'STATUS',
      'DEPARTMENT',
      'LAST ACTIVE',
      'ACTIONS',
    ]);
  });

  it('renders a row with the role badge, status pill, department, and relative last-active', async () => {
    vi.mocked(adminApi.listUsers).mockResolvedValue(
      makePage([makeUser({ last_login_at: new Date(Date.now() - 12 * 60 * 1000).toISOString() })])
    );

    renderPage();

    await screen.findByText('Sarah Ahmed');
    expect(screen.getByText('Team Lead')).toBeInTheDocument();
    // The pill carries a LABEL, not just a colour (brief.md accessibility).
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Support Ops')).toBeInTheDocument();
    expect(screen.getByText(/12 min\.? ago|12m ago/)).toBeInTheDocument();
  });

  it('renders an em dash for a null department and Never for a null last login', async () => {
    vi.mocked(adminApi.listUsers).mockResolvedValue(
      makePage([makeUser({ department: null, last_login_at: null })])
    );

    renderPage();

    await screen.findByText('Sarah Ahmed');
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Never')).toBeInTheDocument();
  });

  // ---- The four async states ---------------------------------------------

  it('renders the Loading state', async () => {
    vi.mocked(adminApi.listUsers).mockReturnValue(new Promise(() => {}));

    const { container } = renderPage();

    await waitFor(() => expect(container.querySelector('.sk')).toBeTruthy());
    expect(screen.queryByRole('table', { name: 'Users' })).not.toBeInTheDocument();
  });

  it('renders the Error state and retries', async () => {
    vi.mocked(adminApi.listUsers).mockRejectedValue(new Error('boom'));

    renderPage();

    const retry = await screen.findByRole('button', { name: /retry|try again/i });

    vi.mocked(adminApi.listUsers).mockResolvedValue(makePage([makeUser()]));
    fireEvent.click(retry);

    await screen.findByText('Sarah Ahmed');
  });

  it('renders the unfiltered Empty state', async () => {
    vi.mocked(adminApi.listUsers).mockResolvedValue(makePage([]));

    renderPage();

    await screen.findByText('No users yet');
    expect(screen.getAllByRole('button', { name: 'Invite User' }).length).toBeGreaterThan(0);
  });

  it('renders the filtered Empty state naming the active filters', async () => {
    vi.mocked(adminApi.listUsers).mockResolvedValue(makePage([]));

    renderPage(['/users?role[]=administrator&status=inactive']);

    await screen.findByText('No users match these filters');
    // Scoped to the Empty body — the chips carry the same text, so an
    // unscoped query matches twice.
    const body = document.querySelector('.dt-empty-body')!;
    expect(body.textContent).toContain('Role: Administrator');
    expect(body.textContent).toContain('Status: Inactive');
  });

  it('renders the Loaded state', async () => {
    vi.mocked(adminApi.listUsers).mockResolvedValue(makePage([makeUser(), makeUser({ id: 2, name: 'Tom Becker' })]));

    renderPage();

    await screen.findByText('Sarah Ahmed');
    expect(screen.getByText('Tom Becker')).toBeInTheDocument();
  });

  // ---- URL filter state ---------------------------------------------------

  it('writes a role filter change to the URL search params', async () => {
    vi.mocked(adminApi.listUsers).mockResolvedValue(makePage([makeUser()]));

    renderPage();

    await screen.findByText('Sarah Ahmed');

    fireEvent.click(screen.getByRole('button', { name: /^Role:/ }));
    const listbox = screen.getByRole('listbox', { name: 'Role' });
    fireEvent.click(within(listbox).getByLabelText(/Administrator/));

    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toContain('role%5B%5D=administrator')
    );
  });

  it('writes a status filter change to the URL search params', async () => {
    vi.mocked(adminApi.listUsers).mockResolvedValue(makePage([makeUser()]));

    renderPage();

    await screen.findByText('Sarah Ahmed');

    fireEvent.click(screen.getByRole('button', { name: /^Status:/ }));
    const listbox = screen.getByRole('listbox', { name: 'Status' });
    fireEvent.click(within(listbox).getByLabelText('Inactive'));

    await waitFor(() => expect(screen.getByTestId('location').textContent).toContain('status=inactive'));
  });

  it('survives a reload — filter state comes from the URL, not component state', async () => {
    vi.mocked(adminApi.listUsers).mockResolvedValue(makePage([makeUser()]));

    // A fresh mount at the same URL is exactly what a reload is.
    renderPage(['/users?role[]=agent&department[]=Platform&status=all&q=kenji&page=2']);

    await screen.findByText('Sarah Ahmed');

    // The list request carries every filter from the URL, so the server (not
    // the client) applies them.
    expect(vi.mocked(adminApi.listUsers)).toHaveBeenCalledWith(
      expect.objectContaining({
        role: ['agent'],
        department: ['Platform'],
        status: 'all',
        q: 'kenji',
        page: 2,
      })
    );

    // And the chips reflect the URL rather than their defaults.
    expect(screen.getByRole('button', { name: /^Role: Agent/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Department: Platform/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Status: All/ })).toBeInTheDocument();
  });

  it('does not write default params into a clean URL', async () => {
    vi.mocked(adminApi.listUsers).mockResolvedValue(makePage([makeUser()]));

    renderPage();

    await screen.findByText('Sarah Ahmed');
    expect(screen.getByTestId('location').textContent).toBe('');
  });

  // ---- Pagination ---------------------------------------------------------

  it('reflects the servers pagination meta in the Showing X–Y of N footer', async () => {
    vi.mocked(adminApi.listUsers).mockResolvedValue(
      makePage([makeUser()], { current_page: 1, last_page: 3, per_page: 6, total: 14 })
    );

    renderPage();

    await screen.findByText('Sarah Ahmed');

    // The design's footer: "Showing 1–6 of 14".
    const summary = document.querySelector('.dt-pagination-summary');
    expect(summary?.textContent?.replace(/\s+/g, ' ')).toContain('Showing 1–6 of 14');
  });

  it('reflects a later page from the servers meta rather than recomputing it', async () => {
    vi.mocked(adminApi.listUsers).mockResolvedValue(
      makePage([makeUser()], { current_page: 3, last_page: 3, per_page: 6, total: 14 })
    );

    renderPage(['/users?page=3']);

    await screen.findByText('Sarah Ahmed');

    const summary = document.querySelector('.dt-pagination-summary');
    expect(summary?.textContent?.replace(/\s+/g, ' ')).toContain('Showing 13–14 of 14');
  });

  it('writes a page change to the URL and requests that page from the server', async () => {
    vi.mocked(adminApi.listUsers).mockResolvedValue(
      makePage([makeUser()], { current_page: 1, last_page: 3, per_page: 6, total: 14 })
    );

    renderPage();

    await screen.findByText('Sarah Ahmed');

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() => expect(screen.getByTestId('location').textContent).toContain('page=2'));
    await waitFor(() =>
      expect(vi.mocked(adminApi.listUsers)).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }))
    );
  });

  // ---- Header count -------------------------------------------------------

  it('counts all internal users and distinct non-null departments in the subtitle', async () => {
    vi.mocked(adminApi.listUsers).mockResolvedValue(makePage([makeUser()], { total: 1 }));

    renderPage();

    // 14 total from the facets endpoint, NOT the 1 row on the filtered page.
    await screen.findByText(/14 internal users across 4 departments/);
  });

  // ---- No delete affordance ----------------------------------------------

  it('offers Deactivate and never Delete', async () => {
    vi.mocked(adminApi.listUsers).mockResolvedValue(makePage([makeUser()]));

    renderPage();

    await screen.findByText('Sarah Ahmed');
    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('disables Deactivate on the signed-in Administrators own row', async () => {
    vi.mocked(adminApi.listUsers).mockResolvedValue(
      makePage([makeUser({ id: adminUser.id, name: 'System Admin', role: 'administrator', role_label: 'Administrator' })])
    );

    renderPage();

    await screen.findByText('System Admin');
    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeDisabled();
  });

  it('offers Activate instead of Deactivate on an inactive row', async () => {
    vi.mocked(adminApi.listUsers).mockResolvedValue(makePage([makeUser({ is_active: false })]));

    renderPage();

    await screen.findByText('Inactive');
    expect(screen.getByRole('button', { name: 'Activate' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument();
  });
});

describe('UsersPage — RTL and dark', () => {
  it('mirrors through ONE grid track list and logical alignment, not an RTL-specific rule', async () => {
    vi.mocked(adminApi.listUsers).mockResolvedValue(makePage([makeUser()]));

    document.documentElement.dir = 'rtl';
    try {
      renderPage();
      await screen.findByText('Sarah Ahmed');

      const rows = Array.from(document.querySelectorAll('.dt-row')) as HTMLElement[];
      const templates = new Set(rows.map((r) => r.style.gridTemplateColumns));

      // A single track list across header and body rows. That is what makes
      // RTL free: the grid flows right-to-left under dir="rtl", so ACTIONS —
      // declared last — lands on the visual LEFT with no second definition.
      expect(templates.size).toBe(1);
      expect([...templates][0]).toBe('32px 2fr 1.5fr 1fr 100px 1fr 120px 150px');

      // The ACTIONS cell aligns with `end`, a direction-relative value, never
      // a hard-coded `right`.
      const headers = screen.getAllByRole('columnheader') as HTMLElement[];
      const actionsHeader = headers[headers.length - 1];
      expect(actionsHeader.textContent?.trim()).toBe('ACTIONS');
      expect(actionsHeader.style.textAlign).toBe('end');
      expect(actionsHeader.style.textAlign).not.toBe('right');

      // The DOM order is unchanged — mirroring is the browser's job, so a
      // reversed column array would double-flip it.
      expect(headers.map((h) => h.textContent?.trim())).toEqual([
        '',
        'USER',
        'EMAIL',
        'ROLE',
        'STATUS',
        'DEPARTMENT',
        'LAST ACTIVE',
        'ACTIONS',
      ]);
    } finally {
      document.documentElement.dir = 'ltr';
    }
  });

  it('takes every colour from a theme token, so dark mode is a token swap', async () => {
    vi.mocked(adminApi.listUsers).mockResolvedValue(makePage([makeUser({ is_active: false })]));

    renderPage();
    await screen.findByText('Inactive');

    // No inline colour on the themed elements — the role badge, status pill,
    // and avatar are all class-driven, so :root[data-theme="dark"] reaches
    // them without a second component.
    for (const selector of ['.role-badge', '.status-pill', '.user-avatar']) {
      const element = document.querySelector(selector) as HTMLElement;
      expect(element, `${selector} is missing`).toBeTruthy();
      expect(element.style.color).toBe('');
      expect(element.style.background).toBe('');
    }

    expect(document.querySelector('.role-badge')?.className).toContain('role-badge-team-lead');
    expect(document.querySelector('.status-pill')?.className).toContain('status-pill-inactive');
  });
});
