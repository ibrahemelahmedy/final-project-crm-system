import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReportsPage } from './ReportsPage';
import { api } from '../../../lib/api';
import type { ReportSummary } from '../model/report';

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api');
  return { ...actual, api: { get: vi.fn() } };
});

const get = api.get as ReturnType<typeof vi.fn>;

function payload(overrides: Partial<ReportSummary> = {}): ReportSummary {
  return {
    range: { from: '2026-07-30', to: '2026-08-28' },
    ticket_volume: {
      available: true,
      points: [
        { date: '2026-08-27', created: 3, resolved: 2 },
        { date: '2026-08-28', created: 1, resolved: 4 },
      ],
    },
    sla: {
      available: true,
      compliance_rate: 91,
      target_rate: 90,
      breach_rate: 9,
      avg_resolution_minutes: 320,
    },
    channels: {
      available: true,
      items: [{ channel: 'email', label: 'Email', count: 44, percent: 44 }],
    },
    agents: {
      available: true,
      items: [
        { user_id: 1, name: 'Sarah Ahmed', deactivated: false, resolved: 11, avg_response_minutes: 11 },
      ],
    },
    csat: { available: false, reason: 'not_collected' },
    ...overrides,
  };
}

function renderPage(path = '/reports') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <ReportsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ReportsPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the loading state', () => {
    get.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('status', { name: /loading report/i })).toBeInTheDocument();
  });

  it('renders the error state with a retry', async () => {
    get.mockRejectedValue({ response: { status: 500 } });
    renderPage();
    expect(await screen.findByText("The report couldn't load.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('renders the page-level empty state when every block is unavailable', async () => {
    get.mockResolvedValue({
      data: payload({
        ticket_volume: { available: false, points: [] },
        sla: { available: false, compliance_rate: null, target_rate: 90, breach_rate: null, avg_resolution_minutes: null },
        channels: { available: false, items: [] },
        agents: { available: false, items: [] },
      }),
    });
    renderPage();
    expect(await screen.findByText(/No ticket activity in this date range/i)).toBeInTheDocument();
  });

  it('renders all five cards from the single payload', async () => {
    get.mockResolvedValue({ data: payload() });
    renderPage();

    expect(await screen.findByText('Ticket Volume Over Time')).toBeInTheDocument();
    expect(screen.getByText('SLA Compliance Rate')).toBeInTheDocument();
    expect(screen.getByText('Tickets by Channel')).toBeInTheDocument();
    expect(screen.getByText('Agent Performance')).toBeInTheDocument();
    expect(screen.getByText('Customer Satisfaction (CSAT)')).toBeInTheDocument();
    expect(screen.getByText('No CSAT data collected yet.')).toBeInTheDocument();

    // Exactly one query for the whole page.
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/reports/summary', expect.objectContaining({ params: expect.anything() }));
  });

  it('changing the range refetches one query against the same endpoint', async () => {
    get.mockResolvedValue({ data: payload() });
    renderPage();
    await screen.findByText('Ticket Volume Over Time');

    const firstParams = get.mock.calls[0][1].params;
    await userEvent.click(screen.getByRole('button', { name: 'Last 7 days' }));

    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(get.mock.calls.every((c) => c[0] === '/reports/summary')).toBe(true);
    expect(get.mock.calls[1][1].params).not.toEqual(firstParams);
  });
});
