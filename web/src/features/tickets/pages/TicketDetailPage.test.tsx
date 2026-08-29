import React, { useEffect } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth, type User } from '../../auth/AuthContext';
import { api } from '../../../lib/api';
import { TicketDetailPage } from './TicketDetailPage';
import { makeTicket } from '../components/thread/testUtils';

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api');
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } };
});

const agent: User = {
  id: 3,
  name: 'Sarah Ahmed',
  email: 'agent@wisal.test',
  role: 'agent',
  role_label: 'Agent',
  home_route: '/dashboard',
  is_active: true,
};

const SignedIn: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { login, status } = useAuth();
  useEffect(() => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { token: 't', user: agent } });
    login(agent.email, 'x');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (status !== 'authenticated') return null;
  return <>{children}</>;
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/tickets/4821']}>
        <AuthProvider>
          <SignedIn>
            <Routes>
              <Route path="/tickets/:ticketId" element={<TicketDetailPage />} />
              <Route path="/tickets" element={<div>Queue</div>} />
            </Routes>
          </SignedIn>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const get = api.get as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TicketDetailPage', () => {
  it('renders ThreadForbidden with a specific reason and no status code on a 403', async () => {
    get.mockImplementation((url: string) => {
      if (url === '/tickets/4821') return Promise.reject({ response: { status: 403 } });
      if (url.includes('/messages'))
        return Promise.resolve({ data: { data: [], links: {}, meta: { next_cursor: null } } });
      return Promise.resolve({ data: { data: [] } });
    });

    renderPage();

    expect(await screen.findByText('You do not have access to this ticket')).toBeInTheDocument();
    expect(screen.getByText(/assigned to another agent/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to tickets/i })).toBeInTheDocument();
    expect(screen.queryByText(/403/)).not.toBeInTheDocument();
  });

  it('shows a skeleton while loading, never an empty frame', async () => {
    let resolve: (v: unknown) => void = () => {};
    get.mockImplementation((url: string) => {
      if (url === '/tickets/4821') return new Promise((r) => (resolve = r));
      if (url.includes('/messages'))
        return Promise.resolve({ data: { data: [], links: {}, meta: { next_cursor: null } } });
      return Promise.resolve({ data: { data: [] } });
    });

    const { container } = renderPage();
    await waitFor(() => expect(container.querySelector('[aria-label="Loading conversation"]')).toBeInTheDocument());
    resolve({ data: { data: makeTicket() } });
  });

  it('keeps chronological order under dir=rtl', async () => {
    document.documentElement.dir = 'rtl';
    get.mockImplementation((url: string) => {
      if (url === '/tickets/4821') return Promise.resolve({ data: { data: makeTicket() } });
      if (url.includes('/messages')) {
        return Promise.resolve({
          data: {
            data: [
              { ...msg(3), created_at: '2026-08-22T10:00:00Z' },
              { ...msg(2), created_at: '2026-08-22T09:00:00Z' },
              { ...msg(1), created_at: '2026-08-22T08:00:00Z' },
            ],
            links: {},
            meta: { next_cursor: null },
          },
        });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    renderPage();

    await waitFor(() => {
      const bubbles = document.querySelectorAll('.thread-bubble');
      expect(bubbles).toHaveLength(3);
    });
    const bodies = [...document.querySelectorAll('.thread-bubble')].map((b) => b.textContent);
    expect(bodies).toEqual(['m1', 'm2', 'm3']);
    document.documentElement.dir = 'ltr';
  });
});

function msg(id: number) {
  return {
    id,
    ticket_id: 4821,
    author_type: 'customer' as const,
    author: { id: 12, name: 'Amelia Chen', initials: 'AC' },
    is_mine: false,
    channel: 'email' as const,
    channel_label: 'Email',
    body: `m${id}`,
    created_at: '2026-08-22T08:00:00Z',
  };
}
