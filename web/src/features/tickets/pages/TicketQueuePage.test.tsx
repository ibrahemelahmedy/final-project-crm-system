import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UiPreferencesProvider } from '../../../app/providers/UiPreferencesContext';
import { TicketQueuePage } from './TicketQueuePage';
import { api } from '../../../lib/api';
import type { Paginated, Ticket } from '../model/ticket';

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api');
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } };
});

const get = api.get as ReturnType<typeof vi.fn>;

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 4821,
    reference: '#4821',
    subject: 'Unable to reset password via email link',
    description: null,
    status: 'open',
    status_label: 'Open',
    priority: 'high',
    priority_label: 'High',
    category: 'account',
    category_label: 'Account',
    channel: 'email',
    channel_label: 'Email',
    customer: { id: 12, name: 'Amelia Chen' },
    assignee: { id: 3, name: 'Sarah Ahmed', initials: 'SA' },
    created_by: { id: 3, name: 'Sarah Ahmed' },
    sla: { due_at: null, minutes_left: null, risk: null },
    resolved_at: null,
    closed_at: null,
    created_at: '2026-08-26T09:12:00.000000Z',
    updated_at: '2026-08-26T11:40:00.000000Z',
    ...overrides,
  };
}

function makePage(tickets: Ticket[], total = tickets.length): Paginated<Ticket> {
  return {
    data: tickets,
    meta: {
      current_page: 1,
      last_page: Math.max(1, Math.ceil(total / 25)),
      per_page: 25,
      from: total ? 1 : null,
      to: total ? tickets.length : null,
      total,
    },
    links: { first: null, last: null, prev: null, next: null },
  };
}

const META = {
  priorities: [{ value: 'high', label: 'High' }],
  statuses: [{ value: 'open', label: 'Open' }],
  channels: [{ value: 'email', label: 'Email' }],
  categories: [{ value: 'account', label: 'Account' }],
  agents: [{ value: '3', label: 'Sarah Ahmed' }],
};

/** Routes each request by URL so list and meta can resolve independently. */
function mockApi(listResult: unknown, { listRejects = false } = {}) {
  get.mockImplementation((url: string) => {
    if (url === '/tickets/meta') return Promise.resolve({ data: META });
    if (url === '/tickets') {
      return listRejects ? Promise.reject(listResult) : Promise.resolve({ data: listResult });
    }
    return Promise.resolve({ data: { data: [] } });
  });
}

function renderPage(path = '/tickets') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <UiPreferencesProvider>
        <MemoryRouter initialEntries={[path]}>
          <TicketQueuePage />
        </MemoryRouter>
      </UiPreferencesProvider>
    </QueryClientProvider>
  );
}

describe('TicketQueuePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('shows the skeleton on first load', () => {
    mockApi(makePage([makeTicket()]));
    renderPage();

    // role="status" + a visually hidden label — the shimmer alone announces nothing.
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading tickets')).toBeInTheDocument();
  });

  it('renders rows and the server total once loaded', async () => {
    mockApi(makePage([makeTicket()], 132));
    renderPage();

    expect(await screen.findByText('#4821')).toBeInTheDocument();
    // The subtitle reads the server's meta.total (132), not rows.length (1).
    const subtitle = document.querySelector('.tq-page-subtitle');
    expect(subtitle?.textContent).toContain('132');
    expect(subtitle?.textContent).toContain('tickets');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows a retryable error without leaking the api url', async () => {
    mockApi({ message: 'Network Error http://localhost:8000/api/tickets' }, { listRejects: true });
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('We could not load the ticket queue.');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    // No raw error, no API URL.
    expect(alert.textContent).not.toContain('http');
  });

  it('renders the 403 branch of the error state', async () => {
    mockApi({ response: { status: 403 } }, { listRejects: true });
    renderPage();

    expect(await screen.findByText('You do not have access to this queue.')).toBeInTheDocument();
  });

  it('shows the empty state when the server returns zero rows', async () => {
    mockApi(makePage([], 0));
    renderPage();

    expect(await screen.findByText('No tickets yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('shows the filtered empty state naming the active facets', async () => {
    mockApi(makePage([], 0));
    renderPage('/tickets?priority=high');

    expect(await screen.findByText('No tickets match your filters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
    expect(screen.getByText(/"Priority"/)).toBeInTheDocument();
  });

  it('opens the create modal when the url carries new=1', async () => {
    mockApi(makePage([makeTicket()]));
    renderPage('/tickets?new=1');

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: 'New Ticket' })).toBeInTheDocument();
  });

  it('sends the filters from the url to the api', async () => {
    mockApi(makePage([makeTicket()]));
    renderPage('/tickets?priority=high&status=open&q=vpn');

    await waitFor(() => expect(get).toHaveBeenCalledWith('/tickets', expect.anything()));

    const call = get.mock.calls.find((c) => c[0] === '/tickets');
    expect(call?.[1].params).toMatchObject({ priority: ['high'], status: ['open'], q: 'vpn' });
    // Without indexes:null Axios emits status[0]=open, which Laravel misreads.
    expect(call?.[1].paramsSerializer).toEqual({ indexes: null });
  });

  it('shows the bulk bar with the count when rows are selected', async () => {
    mockApi(makePage([makeTicket()]));
    renderPage();

    const checkbox = await screen.findByLabelText('Select ticket #4821');
    checkbox.click();

    const region = await screen.findByRole('region', { name: 'Bulk actions' });
    expect(region).toHaveTextContent('1 selected');
  });
});
