import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SuggestedReplyCard } from './SuggestedReplyCard';
import * as assistApi from '../api/assistApi';
import type { AssistArtifact, TicketAssist } from '../model/assist';

vi.mock('../api/assistApi');

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const fetchTicketAssist = assistApi.fetchTicketAssist as ReturnType<typeof vi.fn>;
const generateSuggestion = assistApi.generateSuggestion as ReturnType<typeof vi.fn>;
const dismissSuggestion = assistApi.dismissSuggestion as ReturnType<typeof vi.fn>;

function assistState(overrides: Partial<TicketAssist> = {}): TicketAssist {
  return { enabled: true, summary: null, suggestion: null, ...overrides };
}

/**
 * A stateful stand-in for the real API: `fetchTicketAssist` always reflects
 * the last mutation, matching what the real backend would do. The card's
 * mutations invalidate on settle, which triggers a real refetch — a static
 * mock would snap the UI back to stale data on that refetch.
 */
function statefulAssist(initial: TicketAssist) {
  let state = initial;
  fetchTicketAssist.mockImplementation(() => Promise.resolve(state));
  return {
    setSuggestion: (suggestion: AssistArtifact | null) => {
      state = { ...state, suggestion };
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SuggestedReplyCard', () => {
  it('renders nothing when the feature is disabled', async () => {
    fetchTicketAssist.mockResolvedValue(assistState({ enabled: false }));
    const onUse = vi.fn();
    const { container } = renderWithClient(<SuggestedReplyCard ticketId={4821} onUse={onUse} />);

    await waitFor(() => expect(fetchTicketAssist).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('starts idle, goes to generating, then ready — and Use inserts without sending', async () => {
    const store = statefulAssist(assistState());
    let resolveGenerate: (v: AssistArtifact) => void = () => {};
    generateSuggestion.mockImplementation(
      () =>
        new Promise((r) => {
          resolveGenerate = r;
        })
    );
    const onUse = vi.fn();

    renderWithClient(<SuggestedReplyCard ticketId={4821} onUse={onUse} />);

    const suggestBtn = await screen.findByRole('button', { name: /suggest a reply/i });
    await userEvent.click(suggestBtn);

    // generating: a skeleton, no idle button, no ready actions
    expect(screen.queryByRole('button', { name: /suggest a reply/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /use this reply/i })).not.toBeInTheDocument();

    const artifact: AssistArtifact = {
      content: 'Glad it is resolved!',
      locale: 'en',
      model: 'claude-opus-5',
      created_at: null,
      updated_at: null,
      dismissed: false,
    };
    store.setSuggestion(artifact);
    resolveGenerate(artifact);

    const useBtn = await screen.findByRole('button', { name: /use this reply/i });
    expect(screen.getByText('Glad it is resolved!')).toBeInTheDocument();

    await userEvent.click(useBtn);

    expect(onUse).toHaveBeenCalledWith('Glad it is resolved!');
    expect(await screen.findByText(/review before sending/i)).toBeInTheDocument();
    // Using the reply never calls any send/message API — onUse is the only side effect.
    expect(onUse).toHaveBeenCalledTimes(1);
  });

  it('dismisses back to the idle button', async () => {
    const store = statefulAssist(
      assistState({
        suggestion: {
          content: 'Draft reply',
          locale: 'en',
          model: 'claude-opus-5',
          created_at: null,
          updated_at: null,
          dismissed: false,
        },
      })
    );
    dismissSuggestion.mockImplementation(() => {
      store.setSuggestion({
        content: 'Draft reply',
        locale: 'en',
        model: 'claude-opus-5',
        created_at: null,
        updated_at: null,
        dismissed: true,
      });
      return Promise.resolve(undefined);
    });

    renderWithClient(<SuggestedReplyCard ticketId={4821} onUse={vi.fn()} />);

    const dismissBtn = await screen.findByRole('button', { name: /dismiss/i });
    await userEvent.click(dismissBtn);

    expect(dismissSuggestion).toHaveBeenCalledWith(4821);
    expect(await screen.findByRole('button', { name: /suggest a reply/i })).toBeInTheDocument();
  });

  it('shows the failed card on a generation error and lets the agent retry', async () => {
    const store = statefulAssist(assistState());
    const recovered: AssistArtifact = {
      content: 'Recovered draft',
      locale: 'en',
      model: 'claude-opus-5',
      created_at: null,
      updated_at: null,
      dismissed: false,
    };
    generateSuggestion.mockImplementationOnce(() => Promise.reject(new Error('boom'))).mockImplementationOnce(() => {
      store.setSuggestion(recovered);
      return Promise.resolve(recovered);
    });

    renderWithClient(<SuggestedReplyCard ticketId={4821} onUse={vi.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: /suggest a reply/i }));

    expect(await screen.findByText(/couldn.t generate a suggestion/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByText('Recovered draft')).toBeInTheDocument();
    expect(generateSuggestion).toHaveBeenCalledTimes(2);
  });
});
