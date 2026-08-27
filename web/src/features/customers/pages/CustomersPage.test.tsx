import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth, type User } from '../../auth/AuthContext';
import { api } from '../../../lib/api';
import { CustomersPage } from './CustomersPage';
import * as customersApi from '../api/customersApi';
import type { Customer, CustomerFacets, Paginated } from '../model/customer';

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api');
  return { ...actual, api: { post: vi.fn() } };
});

vi.mock('../api/customersApi');

const makeCustomer = (overrides: Partial<Customer> = {}): Customer => ({
  id: 1,
  name: 'Amelia Chen',
  email: 'amelia.chen@northwind.io',
  phone: null,
  company: 'Northwind Retail',
  tier: 'enterprise',
  tier_label: 'Enterprise',
  initials: 'AC',
  open_tickets_count: 3,
  last_contact_at: '2026-08-22T09:14:00.000000Z',
  created_at: '2023-03-14T00:00:00.000000Z',
  updated_at: '2026-08-22T09:14:00.000000Z',
  ...overrides,
});

const facets: CustomerFacets = {
  companies: [{ value: 'Northwind Retail', count: 1 }],
  tiers: [
    { value: 'standard', label: 'Standard', count: 0 },
    { value: 'premium', label: 'Premium', count: 0 },
    { value: 'enterprise', label: 'Enterprise', count: 1 },
  ],
  total: 1,
};

function makePage(data: Customer[], total = data.length): Paginated<Customer> {
  return { data, meta: { current_page: 1, last_page: 1, per_page: 25, total } };
}

const agentUser: User = {
  id: 1,
  name: 'Sarah Ahmed',
  email: 'agent@wisal.test',
  role: 'agent',
  role_label: 'Agent',
  home_route: '/dashboard',
  is_active: true,
};

const leadUser: User = { ...agentUser, id: 2, role: 'team_lead', role_label: 'Team Lead' };

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

function renderPage(user: User = agentUser) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AuthProvider>
          <SignedInAs user={user}>
            <CustomersPage />
          </SignedInAs>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('CustomersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (customersApi.getFacets as ReturnType<typeof vi.fn>).mockResolvedValue(facets);
  });

  it('renders the skeleton while loading', async () => {
    let resolve!: (v: Paginated<Customer>) => void;
    (customersApi.listCustomers as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );
    renderPage();
    expect(await screen.findByRole('table')).toHaveAttribute('aria-busy', 'true');
    resolve(makePage([makeCustomer()]));
  });

  it('renders the error state with a retry that refetches', async () => {
    (customersApi.listCustomers as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(makePage([makeCustomer()]));
    renderPage();
    const retry = await screen.findByRole('button', { name: 'Try again' });
    fireEvent.click(retry);
    await screen.findByText('Amelia Chen');
  });

  it('renders the empty state naming the active filters, with a reset action', async () => {
    (customersApi.listCustomers as ReturnType<typeof vi.fn>).mockResolvedValue(makePage([], 0));
    renderPage();
    fireEvent.change(await screen.findByLabelText('Search customers'), { target: { value: 'zzz' } });
    await waitFor(() => screen.getByRole('heading', { name: 'No customers match these filters' }));
    expect(screen.getByText(/zzz/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset filters' })).toBeInTheDocument();
  });

  it('renders the no-filter empty state without a reset action', async () => {
    (customersApi.listCustomers as ReturnType<typeof vi.fn>).mockResolvedValue(makePage([], 0));
    renderPage();
    await screen.findByText('No customers yet');
    expect(screen.queryByRole('button', { name: 'Reset filters' })).not.toBeInTheDocument();
  });

  it('renders rows and the server total in the subtitle', async () => {
    (customersApi.listCustomers as ReturnType<typeof vi.fn>).mockResolvedValue(makePage([makeCustomer()], 248));
    renderPage();
    expect(await screen.findByText('248 customers')).toBeInTheDocument();
    expect(screen.getByText('Amelia Chen')).toBeInTheDocument();
  });

  it('shows the bulk bar with the count when rows are selected and clears the selection when a filter changes', async () => {
    (customersApi.listCustomers as ReturnType<typeof vi.fn>).mockResolvedValue(makePage([makeCustomer()]));
    renderPage(leadUser);
    await screen.findByText('Amelia Chen');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Amelia Chen' }));
    expect(await screen.findByText('1 selected')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search customers'), { target: { value: 'chen' } });
    await waitFor(() => expect(screen.queryByText('1 selected')).not.toBeInTheDocument());
  });

  it('names the count and the action in the bulk confirmation', async () => {
    (customersApi.listCustomers as ReturnType<typeof vi.fn>).mockResolvedValue(
      makePage([makeCustomer({ id: 1 }), makeCustomer({ id: 2, name: 'Marcus Webb' }), makeCustomer({ id: 3, name: 'Priya Nair' })])
    );
    renderPage(leadUser);
    await screen.findByText('Amelia Chen');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Amelia Chen' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Marcus Webb' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Priya Nair' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog');
    const heading = within(dialog).getByRole('heading');
    expect(heading).toHaveTextContent('3');
    expect(heading).toHaveTextContent('Delete');
  });

  it('hides destructive bulk actions from an agent', async () => {
    (customersApi.listCustomers as ReturnType<typeof vi.fn>).mockResolvedValue(makePage([makeCustomer()]));
    renderPage(agentUser);
    await screen.findByText('Amelia Chen');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Amelia Chen' }));
    expect(await screen.findByText('1 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });
});
