import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { AuthProvider, useAuth, type User } from '../../auth/AuthContext';
import { api } from '../../../lib/api';
import { CustomerProfilePage } from './CustomerProfilePage';
import * as customersApi from '../api/customersApi';
import type { Customer } from '../model/customer';

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api');
  return { ...actual, api: { post: vi.fn() } };
});

vi.mock('../api/customersApi');

const customer: Customer = {
  id: 1,
  name: 'Amelia Chen',
  email: 'amelia.chen@northwind.io',
  phone: null,
  company: 'Northwind Retail',
  tier: 'enterprise',
  tier_label: 'Enterprise',
  initials: 'AC',
  open_tickets_count: 0,
  last_contact_at: null,
  created_at: '2023-03-14T00:00:00.000000Z',
  updated_at: '2023-03-14T00:00:00.000000Z',
};

const agentUser: User = {
  id: 1,
  name: 'Sarah Ahmed',
  email: 'agent@wisal.test',
  role: 'agent',
  role_label: 'Agent',
  home_route: '/dashboard',
  is_active: true,
};

const SignedInAs: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { login, status } = useAuth();
  React.useEffect(() => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { token: 't', user: agentUser } });
    login(agentUser.email, 'Password123!');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (status !== 'authenticated') return null;
  return <>{children}</>;
};

function renderProfile() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/customers/1']}>
        <AuthProvider>
          <SignedInAs>
            <Routes>
              <Route path="/customers/:customerId" element={<CustomerProfilePage />} />
            </Routes>
          </SignedInAs>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('CustomerProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (customersApi.getCustomer as ReturnType<typeof vi.fn>).mockResolvedValue(customer);
    (customersApi.listAttachments as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 },
    });
  });

  it('shows the pending-story notice instead of an empty state when meta.pending_story is set', async () => {
    (customersApi.listCustomerTickets as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 20, total: 0, pending_story: 'WIS-2' },
    });
    (customersApi.listNotes as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 },
    });
    renderProfile();
    expect(await screen.findByText('Ticket history appears here once Ticket Management ships.')).toBeInTheDocument();
  });

  it('lists notes newest first with author and timestamp', async () => {
    (customersApi.listCustomerTickets as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 20, total: 0, pending_story: 'WIS-2' },
    });
    (customersApi.listNotes as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        { id: 2, body: 'Second note', author: { id: 1, name: 'Sarah Ahmed' }, created_at: '2026-08-22T10:00:00Z' },
        { id: 1, body: 'First note', author: { id: 1, name: 'Sarah Ahmed' }, created_at: '2026-08-21T10:00:00Z' },
      ],
      meta: { current_page: 1, last_page: 1, per_page: 20, total: 2 },
    });
    renderProfile();
    await screen.findByText('Second note');
    const notes = document.querySelectorAll('.note-body');
    expect(notes[0]).toHaveTextContent('Second note');
    expect(notes[1]).toHaveTextContent('First note');
    expect(screen.getAllByText('Sarah Ahmed').length).toBeGreaterThan(0);
  });

  it('renders a note body as text', async () => {
    (customersApi.listCustomerTickets as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 20, total: 0, pending_story: 'WIS-2' },
    });
    (customersApi.listNotes as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        {
          id: 1,
          body: '<img src=x onerror=alert(1)>',
          author: { id: 1, name: 'Sarah Ahmed' },
          created_at: '2026-08-21T10:00:00Z',
        },
      ],
      meta: { current_page: 1, last_page: 1, per_page: 20, total: 1 },
    });
    renderProfile();
    await screen.findByText('<img src=x onerror=alert(1)>');
    expect(document.querySelector('img[src="x"]')).toBeNull();
  });

  it("shows the server's rejection message for an oversized attachment", async () => {
    (customersApi.listCustomerTickets as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 20, total: 0, pending_story: 'WIS-2' },
    });
    (customersApi.listNotes as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 },
    });
    (customersApi.uploadAttachment as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      Object.assign(new AxiosError('fail'), {
        response: { status: 422, data: { errors: { file: ['That file is too large. The limit is 10.0 MB.'] } } },
      })
    );
    renderProfile();
    await screen.findByText('Attachments');
    const input = document.querySelector('.dropzone-input') as HTMLInputElement;
    const file = new File(['x'.repeat(20)], 'big.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByText('That file is too large. The limit is 10.0 MB.')).toBeInTheDocument();
  });
});
