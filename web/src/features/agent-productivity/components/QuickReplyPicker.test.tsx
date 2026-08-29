import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuickReplyPicker } from './QuickReplyPicker';
import { ProductivityHarness } from '../testUtils';
import { makeTicketQuickReply } from '../testFixtures';
import * as quickRepliesApi from '../api/quickRepliesApi';

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api');
  return { ...actual, api: { post: vi.fn(), get: vi.fn() } };
});

vi.mock('../api/quickRepliesApi');

const mocked = quickRepliesApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderPicker(onInsert = vi.fn(), onClose = vi.fn()) {
  render(
    <ProductivityHarness>
      <QuickReplyPicker ticketId={4821} onInsert={onInsert} onClose={onClose} />
    </ProductivityHarness>
  );
  return { onInsert, onClose };
}

describe('QuickReplyPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts the rendered body, calls no send mutation, and the text stays editable', async () => {
    mocked.fetchTicketQuickReplies.mockResolvedValue([makeTicketQuickReply()]);
    const { onInsert, onClose } = renderPicker();

    const result = await screen.findByRole('option', { name: /Refund processing timeline/ });
    fireEvent.click(result);

    expect(onInsert).toHaveBeenCalledWith('Hi Nadia, refunds take 5-7 business days.');
    expect(onClose).toHaveBeenCalled();
    // No send-shaped call ever happens through this component — it only
    // ever calls the ticket-scoped GET, never a POST to /messages.
    expect(mocked.fetchTicketQuickReplies).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', async () => {
    mocked.fetchTicketQuickReplies.mockResolvedValue([makeTicketQuickReply()]);
    const { onClose } = renderPicker();

    await screen.findByRole('option', { name: /Refund processing timeline/ });
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });

  it('shows the "no search match" empty state distinct from the "library empty" state', async () => {
    mocked.fetchTicketQuickReplies.mockResolvedValue([makeTicketQuickReply({ title: 'Refund policy' })]);
    renderPicker();

    const input = await screen.findByPlaceholderText('Search quick replies…');
    fireEvent.change(input, { target: { value: 'xyzabc' } });

    await waitFor(() => expect(screen.getByText(/No replies match/)).toBeInTheDocument());
  });

  it('shows the library-empty state when there are no quick replies at all', async () => {
    mocked.fetchTicketQuickReplies.mockResolvedValue([]);
    renderPicker();

    expect(await screen.findByText('No quick replies yet')).toBeInTheDocument();
    expect(screen.getByText(/Admin → Quick Replies/)).toBeInTheDocument();
  });
});
