import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { PortalRequestDetailPage } from './PortalRequestDetailPage';
import * as portalApi from '../api/portalApi';
import { renderPortal, ticket, message, pending } from '../testUtils';
import type { PortalTicketDetail } from '../model/portal';

vi.mock('../api/portalApi');

const fetchRequest = vi.mocked(portalApi.fetchPortalRequest);
const reply = vi.mocked(portalApi.replyToPortalRequest);

const detail = (overrides: Partial<PortalTicketDetail> = {}): PortalTicketDetail => ({
  ticket: ticket(),
  messages: [
    message({ id: 1, author_type: 'customer', body: 'My card keeps getting declined.' }),
    message({ id: 2, author_type: 'agent', author_name: 'Sam Patel', body: 'Looking into it now.' }),
    message({ id: 3, author_type: 'system', author_name: null, body: 'Request reopened.' }),
  ],
  ...overrides,
});

const axios404 = () =>
  new AxiosError('Not Found', '404', undefined, null, {
    status: 404,
    statusText: 'Not Found',
    data: {},
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

function render(path = '/portal/requests/42') {
  return renderPortal(<PortalRequestDetailPage />, { path: '/portal/requests/:ticketId', route: path });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PortalRequestDetailPage', () => {
  it('renders a skeleton while loading', () => {
    fetchRequest.mockReturnValue(pending());
    const { container } = render();

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it('renders a retryable error state for a transport failure', async () => {
    fetchRequest.mockRejectedValue(new Error('boom'));
    render();

    expect(await screen.findByText(/couldn't load this request/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('treats a 404 as "not found" with a way back, not as a crash', async () => {
    fetchRequest.mockRejectedValue(axios404());
    render();

    expect(await screen.findByText(/couldn't find that request/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Track requests' })).toHaveAttribute(
      'href',
      '/portal/requests'
    );
  });

  it('renders agent, customer, and system messages distinctly', async () => {
    fetchRequest.mockResolvedValue(detail());
    const { container } = render();

    expect(await screen.findByText('My card keeps getting declined.')).toBeInTheDocument();
    expect(container.querySelectorAll('.portal-message-customer')).toHaveLength(1);
    expect(container.querySelectorAll('.portal-message-agent')).toHaveLength(1);
    expect(container.querySelectorAll('.portal-message-system')).toHaveLength(1);
    // A system line carries no author chip; the other two name their author.
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getByText('Sam Patel')).toBeInTheDocument();
  });

  it('renders an empty thread state', async () => {
    fetchRequest.mockResolvedValue(detail({ messages: [] }));
    render();

    expect(await screen.findByText(/No messages on this request yet/)).toBeInTheDocument();
  });

  it('renders a message body as TEXT, never as markup (AC5 / XSS)', async () => {
    fetchRequest.mockResolvedValue(
      detail({ messages: [message({ body: '<script>alert(1)</script>' })] })
    );
    const { container } = render();

    expect(await screen.findByText('<script>alert(1)</script>')).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
  });

  it('sends a reply and clears the composer', async () => {
    const user = userEvent.setup();
    fetchRequest.mockResolvedValue(detail());
    reply.mockResolvedValue(ticket());
    render();

    const box = await screen.findByLabelText('Write a reply');
    await user.type(box, 'Any update?');
    await user.click(screen.getByRole('button', { name: 'Send reply' }));

    await waitFor(() => expect(reply).toHaveBeenCalledWith('42', 'Any update?'));
    await waitFor(() => expect(box).toHaveValue(''));
  });

  it('will not send an empty reply', async () => {
    fetchRequest.mockResolvedValue(detail());
    render();

    await screen.findByLabelText('Write a reply');
    expect(screen.getByRole('button', { name: 'Send reply' })).toBeDisabled();
  });

  it('surfaces a failed reply without losing the draft', async () => {
    const user = userEvent.setup();
    fetchRequest.mockResolvedValue(detail());
    reply.mockRejectedValue(new Error('boom'));
    render();

    const box = await screen.findByLabelText('Write a reply');
    await user.type(box, 'Any update?');
    await user.click(screen.getByRole('button', { name: 'Send reply' }));

    expect(await screen.findByText(/reply wasn't sent/)).toBeInTheDocument();
    expect(box).toHaveValue('Any update?');
  });

  it('replaces the composer with an explanation on a closed request', async () => {
    fetchRequest.mockResolvedValue(
      detail({ ticket: ticket({ status: 'closed', status_label: 'Closed', closed_at: '2026-08-25T10:00:00Z' }) })
    );
    render();

    expect(await screen.findByText(/closed and can no longer receive replies/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Write a reply')).not.toBeInTheDocument();
  });

  it('links to Story 13 feedback only when the API carries a feedback_url (AC7)', async () => {
    fetchRequest.mockResolvedValue(
      detail({
        ticket: ticket({
          status: 'resolved',
          status_label: 'Resolved',
          resolved_at: '2026-08-20T12:00:00Z',
          feedback_url: 'https://wisal.test/feedback/abc-123?signature=deadbeef',
        }),
      })
    );
    render();

    const link = await screen.findByRole('link', { name: 'Rate your support experience' });
    // Byte-identical to what the API minted — the portal never builds this URL.
    expect(link).toHaveAttribute('href', 'https://wisal.test/feedback/abc-123?signature=deadbeef');
  });

  it('renders no feedback link when the survey is answered or expired', async () => {
    fetchRequest.mockResolvedValue(
      detail({ ticket: ticket({ status: 'resolved', status_label: 'Resolved', feedback_url: null }) })
    );
    render();

    await screen.findByText('Payment not going through');
    expect(screen.queryByRole('link', { name: 'Rate your support experience' })).not.toBeInTheDocument();
  });
});
