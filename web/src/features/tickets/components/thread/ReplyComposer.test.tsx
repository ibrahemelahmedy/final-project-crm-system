import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ReplyComposer } from './ReplyComposer';
import { makeTicket } from './testUtils';

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
});
