import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AiSummaryCard } from './AiSummaryCard';
import * as assistApi from '../api/assistApi';
import type { TicketAssist } from '../model/assist';

vi.mock('../api/assistApi');

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const fetchTicketAssist = assistApi.fetchTicketAssist as ReturnType<typeof vi.fn>;
const generateSummary = assistApi.generateSummary as ReturnType<typeof vi.fn>;

function assistState(overrides: Partial<TicketAssist> = {}): TicketAssist {
  return { enabled: true, summary: null, suggestion: null, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AiSummaryCard', () => {
  it('renders nothing when the feature is disabled', async () => {
    fetchTicketAssist.mockResolvedValue(assistState({ enabled: false }));
    const { container } = renderWithClient(<AiSummaryCard ticketId={4821} />);

    await waitFor(() => expect(fetchTicketAssist).toHaveBeenCalled());
    expect(generateSummary).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it('auto-generates once on mount when no summary is cached', async () => {
    // Stateful: `onSettled` invalidates and refetches after the mutation —
    // a static fetchTicketAssist mock would snap the UI back to `summary:
    // null` on that refetch, which is not what the real backend would do.
    let state = assistState();
    fetchTicketAssist.mockImplementation(() => Promise.resolve(state));
    const summary = {
      content: 'Ticket summary text.',
      locale: 'en',
      model: 'claude-opus-5',
      created_at: '2026-08-22T08:00:00Z',
      updated_at: '2026-08-22T08:00:00Z',
      dismissed: false,
    };
    generateSummary.mockImplementation(() => {
      state = { ...state, summary };
      return Promise.resolve(summary);
    });

    renderWithClient(<AiSummaryCard ticketId={4821} />);

    await waitFor(() => expect(generateSummary).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Ticket summary text.')).toBeInTheDocument();
  });

  it('does not retry a failed generation on its own — the agent must press Retry', async () => {
    fetchTicketAssist.mockResolvedValue(assistState());
    generateSummary.mockRejectedValue(new Error('boom'));

    renderWithClient(<AiSummaryCard ticketId={4821} />);

    await screen.findByText(/couldn.t generate a summary/i);
    await waitFor(() => expect(generateSummary).toHaveBeenCalledTimes(1));

    // No further calls fire on their own after the failure settles.
    await new Promise((r) => setTimeout(r, 50));
    expect(generateSummary).toHaveBeenCalledTimes(1);
  });

  it('does not auto-generate when a summary is already cached', async () => {
    fetchTicketAssist.mockResolvedValue(
      assistState({
        summary: {
          content: 'Already have one.',
          locale: 'en',
          model: 'claude-opus-5',
          created_at: '2026-08-22T08:00:00Z',
          updated_at: '2026-08-22T08:00:00Z',
          dismissed: false,
        },
      })
    );

    renderWithClient(<AiSummaryCard ticketId={4821} />);

    expect(await screen.findByText('Already have one.')).toBeInTheDocument();
    expect(generateSummary).not.toHaveBeenCalled();
  });
});
