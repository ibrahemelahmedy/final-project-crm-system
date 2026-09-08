import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from './i18n/instance';
import { AuthProvider, useAuth, type User } from './features/auth/AuthContext';
import { api } from './lib/api';
import { CustomersPage } from './features/customers/pages/CustomersPage';
import * as customersApi from './features/customers/api/customersApi';
import type { Customer, CustomerFacets, Paginated } from './features/customers/model/customer';

vi.mock('./lib/api', async () => {
  const actual = await vi.importActual('./lib/api');
  return { ...actual, api: { post: vi.fn() } };
});
vi.mock('./features/customers/api/customersApi');

const CHROME_STRINGS_EN = [
  'Customers', 'customers', 'Add Customer', 'Search customers', 'Company', 'Tier',
  'No customers match these filters', 'Reset filters', 'No customers yet',
];

const makeCustomer = (overrides: Partial<Customer> = {}): Customer => ({
  id: 1, name: 'Amelia Chen', email: 'amelia.chen@northwind.io', phone: null,
  company: 'Northwind Retail', tier: 'enterprise', tier_label: 'Enterprise',
  initials: 'AC', open_tickets_count: 3, last_contact_at: '2026-08-22T09:14:00.000000Z',
  created_at: '2023-03-14T00:00:00.000000Z', updated_at: '2026-08-22T09:14:00.000000Z',
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
  id: 1, name: 'Sarah Ahmed', email: 'agent@wisal.test', role: 'agent',
  role_label: 'Agent', home_route: '/dashboard', is_active: true,
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
      <MemoryRouter>
        <AuthProvider>
          <SignedInAs user={agentUser}>
            <CustomersPage />
          </SignedInAs>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('Customers — Arabic chrome sweep', () => {
  it('renders no English chrome string under ar (populated table)', async () => {
    await i18n.changeLanguage('ar');
    (customersApi.getFacets as ReturnType<typeof vi.fn>).mockResolvedValue(facets);
    (customersApi.listCustomers as ReturnType<typeof vi.fn>).mockResolvedValue(makePage([makeCustomer()]));
    renderPage();
    await waitFor(() => expect((document.body.textContent ?? '').length).toBeGreaterThan(20));
    const body = document.body.textContent ?? '';
    const hits = CHROME_STRINGS_EN.filter((s) => body.includes(s));
    expect(hits, `English chrome leaked under ar: ${hits.join(', ')}`).toEqual([]);
  });

  it('renders no English chrome string under ar (empty state)', async () => {
    await i18n.changeLanguage('ar');
    (customersApi.getFacets as ReturnType<typeof vi.fn>).mockResolvedValue(facets);
    (customersApi.listCustomers as ReturnType<typeof vi.fn>).mockResolvedValue(makePage([]));
    renderPage();
    await waitFor(() => expect((document.body.textContent ?? '').length).toBeGreaterThan(20));
    const body = document.body.textContent ?? '';
    const hits = CHROME_STRINGS_EN.filter((s) => body.includes(s));
    expect(hits, `English chrome leaked under ar: ${hits.join(', ')}`).toEqual([]);
  });
});
