import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReplyComposer } from './ReplyComposer';
import { makeTicket } from './testUtils';
import { SuggestedReplyCard } from '../../../ai-assist';
import * as assistApi from '../../../ai-assist/api/assistApi';

vi.mock('../../../ai-assist/api/assistApi');

function setup(onSend: (body: string) => Promise<unknown>) {
  return render(<ReplyComposer ticket={makeTicket()} isSending={false} onSend={onSend} />);
}

describe('ReplyComposer', () => {
  it('sends the trimmed body and clears the textarea on success', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    setup(onSend);
    const ta = screen.getByLabelText(/reply to ticket/i);
    await userEvent.type(ta, '  hello team  ');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(onSend).toHaveBeenCalledWith('hello team');
    await waitFor(() => expect((ta as HTMLTextAreaElement).value).toBe(''));
  });

  it('preserves the draft and offers Retry on a failed send', async () => {
    const onSend = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(undefined);
    setup(onSend);
    const ta = screen.getByLabelText(/reply to ticket/i);
    await userEvent.type(ta, 'keep me');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));

    await screen.findByRole('alert');
    expect((ta as HTMLTextAreaElement).value).toBe('keep me');

    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onSend).toHaveBeenLastCalledWith('keep me');
  });

  it('refuses a whitespace-only reply without calling onSend', async () => {
    const onSend = vi.fn();
    setup(onSend);
    const ta = screen.getByLabelText(/reply to ticket/i);
    await userEvent.type(ta, '   ');
    // button is disabled on empty-trimmed; force a keyboard submit
    await userEvent.type(ta, '{Control>}{Enter}{/Control}');

    expect(await screen.findByText('Write a reply before sending.')).toBeInTheDocument();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('stays fully usable — textarea enabled, Send still fires — when the AI suggestion request fails', async () => {
    const fetchTicketAssist = assistApi.fetchTicketAssist as ReturnType<typeof vi.fn>;
    const generateSuggestion = assistApi.generateSuggestion as ReturnType<typeof vi.fn>;
    fetchTicketAssist.mockResolvedValue({ enabled: true, summary: null, suggestion: null });
    generateSuggestion.mockRejectedValue(new Error('AI is down'));

    const onSend = vi.fn().mockResolvedValue(undefined);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ReplyComposer
          ticket={makeTicket()}
          isSending={false}
          onSend={onSend}
          assistSlot={<SuggestedReplyCard ticketId={4821} onUse={() => {}} />}
        />
      </QueryClientProvider>
    );

    await userEvent.click(await screen.findByRole('button', { name: /suggest a reply/i }));
    expect(await screen.findByText(/couldn.t generate a suggestion/i)).toBeInTheDocument();

    // The composer itself is untouched by the AI failure.
    const ta = screen.getByLabelText(/reply to ticket/i);
    expect(ta).toBeEnabled();
    await userEvent.type(ta, 'still works');
    await userEvent.click(screen.getByRole('button', { name: /^send$/i }));

    expect(onSend).toHaveBeenCalledWith('still works');
  });
});
