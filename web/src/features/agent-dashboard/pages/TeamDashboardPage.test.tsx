import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TeamDashboardPage } from './TeamDashboardPage';
import { api } from '../../../lib/api';
import type { Ticket } from '../../tickets';

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api');
  return { ...actual, api: { get: vi.fn() } };
});

const get = api.get as ReturnType<typeof vi.fn>;

function escalation(overrides: Partial<Ticket> = {}) {
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
    customer: { id: 1, name: 'Nadia K.' },
    assignee: { id: 2, name: 'Sarah Ahmed', initials: 'SA' },
    created_by: null,
    sla: { due_at: '2026-08-28T10:00:00Z', minutes_left: -30, risk: 'breached' },
    resolved_at: null,
    closed_at: null,
    created_at: '2026-08-28T06:00:00.000000Z',
    updated_at: '2026-08-28T06:00:00.000000Z',
    escalated_by_name: 'Sarah Ahmed',
    escalated_at: '2026-08-28T09:48:00.000000Z',
    ...overrides,
  };
}

function mockRoutes(routes: Record<string, unknown>) {
  get.mockImplementation((url: string) => {
    if (url in routes) return Promise.resolve({ data: routes[url] });
    return Promise.reject({ response: { status: 500 } });
  });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TeamDashboardPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('TeamDashboardPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders Workload Balance and Escalations with a ticket link', async () => {
    mockRoutes({
      '/dashboard/team/summary': { team_name: 'Support Ops', agent_count: 5, open_count: 94, escalation_count: 4, sla_compliance_pct: 91 },
      '/dashboard/team/workload': [{ user_id: 1, name: 'Sarah Ahmed', open_count: 18 }],
      '/dashboard/team/escalations': { data: [escalation()] },
    });
    renderPage();

    expect(await screen.findByText('Workload Balance')).toBeInTheDocument();
    expect(await screen.findByText('Sarah Ahmed')).toBeInTheDocument();
    const link = await screen.findByRole('link', { name: /Payment not going through/ });
    expect(link).toHaveAttribute('href', '/tickets/4821');
    expect(screen.getByText(/Escalated by Sarah Ahmed/)).toBeInTheDocument();
  });

  it('renders the Empty state for zero agents', async () => {
    mockRoutes({
      '/dashboard/team/summary': { team_name: 'Support Ops', agent_count: 0, open_count: 0, escalation_count: 0, sla_compliance_pct: null },
      '/dashboard/team/workload': [],
      '/dashboard/team/escalations': { data: [] },
    });
    renderPage();

    expect(await screen.findByText(/No agents on this team yet/)).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument(); // compliance tile
  });
});
