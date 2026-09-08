import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from './i18n/instance';
import { TicketCsatPanel } from './features/csat/components/TicketCsatPanel';
import * as csatApi from './features/csat/api/csatApi';
import type { TicketCsat } from './features/csat/model/csat';

vi.mock('./features/csat/api/csatApi');
const mocked = csatApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

const CHROME_STRINGS_EN = [
  'CSAT SURVEY', "Couldn't load the survey.", 'Retry', 'No survey for this resolution cycle yet.',
  'Share this feedback link with the customer', 'Copied', 'Copy link', 'No comment left.',
  'The feedback link expired with no response.',
];

function renderPanel(data: TicketCsat) {
  mocked.fetchTicketCsat.mockResolvedValue(data);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TicketCsatPanel ticketId={1} ticketStatus="resolved" />
    </QueryClientProvider>
  );
}

afterEach(async () => {
  await i18n.changeLanguage('en');
  vi.clearAllMocks();
});

describe('TicketCsatPanel — Arabic chrome sweep', () => {
  it('outstanding state: no English chrome under ar', async () => {
    await i18n.changeLanguage('ar');
    renderPanel({
      state: 'outstanding', resolution_cycle: 1, resolved_at: null, expires_at: null,
      share_url: 'https://wisal.test/feedback/abc', rating: null, comment: null, responded_at: null,
    });
    await waitFor(() => expect((document.body.textContent ?? '').length).toBeGreaterThan(10));
    const body = document.body.textContent ?? '';
    const hits = CHROME_STRINGS_EN.filter((s) => body.includes(s));
    expect(hits, `English chrome leaked under ar: ${hits.join(', ')}`).toEqual([]);
  });

  it('answered state (no comment): no English chrome under ar', async () => {
    await i18n.changeLanguage('ar');
    renderPanel({
      state: 'answered', resolution_cycle: 1, resolved_at: '2026-08-01T00:00:00Z',
      expires_at: null, share_url: 'https://wisal.test/feedback/abc', rating: 4,
      comment: null, responded_at: '2026-08-02T00:00:00Z',
    });
    await waitFor(() => expect((document.body.textContent ?? '').length).toBeGreaterThan(10));
    const body = document.body.textContent ?? '';
    const hits = CHROME_STRINGS_EN.filter((s) => body.includes(s));
    expect(hits, `English chrome leaked under ar: ${hits.join(', ')}`).toEqual([]);
  });

  it('none state: no English chrome under ar', async () => {
    await i18n.changeLanguage('ar');
    renderPanel({ state: 'none' });
    await waitFor(() => expect((document.body.textContent ?? '').length).toBeGreaterThan(10));
    const body = document.body.textContent ?? '';
    const hits = CHROME_STRINGS_EN.filter((s) => body.includes(s));
    expect(hits, `English chrome leaked under ar: ${hits.join(', ')}`).toEqual([]);
  });

  it('expired state: no English chrome under ar', async () => {
    await i18n.changeLanguage('ar');
    renderPanel({
      state: 'expired', resolution_cycle: 1, resolved_at: '2026-06-01T00:00:00Z',
      expires_at: '2026-07-01T00:00:00Z', share_url: 'https://wisal.test/feedback/abc',
      rating: null, comment: null, responded_at: null,
    });
    await waitFor(() => expect((document.body.textContent ?? '').length).toBeGreaterThan(10));
    const body = document.body.textContent ?? '';
    const hits = CHROME_STRINGS_EN.filter((s) => body.includes(s));
    expect(hits, `English chrome leaked under ar: ${hits.join(', ')}`).toEqual([]);
  });
});
