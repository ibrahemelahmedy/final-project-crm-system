import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AgentDashboardPage } from './AgentDashboardPage';
import { api } from '../../../lib/api';
import type { Ticket } from '../../tickets';

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api');
  return { ...actual, api: { get: vi.fn() } };
});

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'Sarah Ahmed', role: 'agent', role_label: 'Agent', home_route: '/dashboard' },
    status: 'authenticated',
  }),
}));

const get = api.get as ReturnType<typeof vi.fn>;

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 4821,
    reference: '#4821',
    subject: 'Payment not going through',
    description: null,
    status: 'open',
    status_label: 'Open',
    priority: 'urgent',
    priority_label: 'Urgent',
    category: 'billing',
    category_label: 'Billing',
    channel: 'email',
    channel_label: 'Email',
    customer: { id: 12, name: 'Nadia K.' },
    assignee: { id: 1, name: 'Sarah Ahmed', initials: 'SA' },
    created_by: null,
    sla: { due_at: '2026-08-28T10:00:00Z', minutes_left: 18, risk: 'breached' },
    resolved_at: null,
    closed_at: null,
    created_at: '2026-08-28T08:00:00.000000Z',
    updated_at: '2026-08-28T08:00:00.000000Z',
    ...overrides,
  };
}

type Routes = Record<string, unknown | (() => Promise<unknown>)>;

function mockRoutes(routes: Routes) {
  get.mockImplementation((url: string) => {
    const entry = routes[url];
    if (entry === undefined) return Promise.reject({ response: { status: 500 } });
    if (typeof entry === 'function') return (entry as () => Promise<unknown>)();
    return Promise.resolve({ data: entry });
  });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AgentDashboardPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const OK_ROUTES: Routes = {
  '/dashboard/agent/summary': { assigned_count: 18, sla_risk_count: 3, resolved_today_count: 9 },
  '/dashboard/agent/queue': { data: [makeTicket()] },
  '/dashboard/agent/sla-risk': { data: [makeTicket()] },
  '/quick-replies': [{ id: 1, title: 'Password reset instructions' }],
};

describe('AgentDashboardPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the greeting and all four widgets', async () => {
    mockRoutes(OK_ROUTES);
    renderPage();

    expect(screen.getByRole('heading', { name: /Sarah/ })).toBeInTheDocument();
    expect(await screen.findByText('My Queue')).toBeInTheDocument();
    expect(screen.getByText('Approaching SLA Breach')).toBeInTheDocument();
    expect(screen.getByText('Quick Replies')).toBeInTheDocument();
    expect(await screen.findByText('Payment not going through')).toBeInTheDocument();
    expect(await screen.findByText('Password reset instructions')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
  });

  it('keeps the other three widgets when one widget query rejects', async () => {
    mockRoutes({
      ...OK_ROUTES,
      '/dashboard/agent/queue': () => Promise.reject({ response: { status: 500 } }),
    });
    renderPage();

    expect(await screen.findByText("Your queue couldn't load.")).toBeInTheDocument();
    // siblings still render their data
    expect(await screen.findByText('Password reset instructions')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('shows the Empty copy, not a 0, for an empty queue', async () => {
    mockRoutes({ ...OK_ROUTES, '/dashboard/agent/queue': { data: [] } });
    renderPage();

    expect(await screen.findByText(/No tickets assigned to you yet/)).toBeInTheDocument();
  });
});
