import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from './i18n/instance';
import { ReportsPage } from './features/reports/pages/ReportsPage';
import { api } from './lib/api';
import type { ReportSummary } from './features/reports/model/report';

vi.mock('./lib/api', async () => {
  const actual = await vi.importActual('./lib/api');
  return { ...actual, api: { get: vi.fn() } };
});

const get = api.get as ReturnType<typeof vi.fn>;

const CHROME_STRINGS_EN = [
  'Reports', "couldn't load", 'Try again', 'Last 7 days', 'Last 30 days', 'Last 90 days',
  'From', 'To', 'Agent Performance', 'Resolved', 'Avg. Response', 'deactivated',
  'Tickets by Channel', 'Customer Satisfaction', 'response', 'SLA Compliance Rate',
  'Target:', 'Breach rate', 'Avg. resolution time', 'Ticket Volume Over Time',
  'Created', 'No ticket activity',
];

function payload(overrides: Partial<ReportSummary> = {}): ReportSummary {
  return {
    range: { from: '2026-07-30', to: '2026-08-28' },
    ticket_volume: { available: true, points: [{ date: '2026-08-27', created: 3, resolved: 2 }] },
    sla: { available: true, compliance_rate: 91, target_rate: 90, breach_rate: 9, avg_resolution_minutes: 320 },
    channels: { available: true, items: [{ channel: 'email', label: 'Email', count: 44, percent: 44 }] },
    agents: { available: true, items: [{ user_id: 1, name: 'Sarah Ahmed', deactivated: true, resolved: 11, avg_response_minutes: 11 }] },
    csat: { available: true, average: 4.2, response_count: 7, by_agent: [{ user_id: 1, name: 'Sarah Ahmed', response_count: 3, average: 4.5 }] },
    ...overrides,
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/reports']}>
        <ReportsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('Reports — Arabic chrome sweep', () => {
  it('renders no English chrome string under ar (all five cards populated)', async () => {
    await i18n.changeLanguage('ar');
    get.mockResolvedValue({ data: payload() });
    renderPage();
    await waitFor(() => expect((document.body.textContent ?? '').length).toBeGreaterThan(20));
    const body = document.body.textContent ?? '';
    const hits = CHROME_STRINGS_EN.filter((s) => body.includes(s));
    expect(hits, `English chrome leaked under ar: ${hits.join(', ')}`).toEqual([]);
  });

  it('renders no English chrome string under ar (error state)', async () => {
    await i18n.changeLanguage('ar');
    get.mockRejectedValue({ response: { status: 500 } });
    renderPage();
    await waitFor(() => expect((document.body.textContent ?? '').length).toBeGreaterThan(5));
    const body = document.body.textContent ?? '';
    const hits = CHROME_STRINGS_EN.filter((s) => body.includes(s));
    expect(hits, `English chrome leaked under ar: ${hits.join(', ')}`).toEqual([]);
  });
});
