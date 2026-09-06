import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PortalHistoryPage } from './PortalHistoryPage';
import * as portalApi from '../api/portalApi';
import { renderPortal, ticket, page, pending } from '../testUtils';

vi.mock('../api/portalApi');

const fetchRequests = vi.mocked(portalApi.fetchPortalRequests);

const resolved = () =>
  ticket({
    id: 9,
    subject: 'Refund for duplicate charge',
    status: 'resolved',
    status_label: 'Resolved',
    resolved_at: '2026-08-20T12:00:00Z',
  });

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * AC4 — "view history". A SEPARATE route from AC3's, so the two criteria can
 * be asserted independently; this file is the other half of that argument.
 */
describe('PortalHistoryPage', () => {
  it('asks the API for the PAST scope', async () => {
    fetchRequests.mockResolvedValue(page([resolved()]));
    renderPortal(<PortalHistoryPage />, { path: '/portal/history' });

    await waitFor(() => expect(fetchRequests).toHaveBeenCalledWith('past', 1));
  });

  it('renders a skeleton while loading', () => {
    fetchRequests.mockReturnValue(pending());
    const { container } = renderPortal(<PortalHistoryPage />, { path: '/portal/history' });

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it('renders a retryable error state', async () => {
    fetchRequests.mockRejectedValue(new Error('boom'));
    renderPortal(<PortalHistoryPage />, { path: '/portal/history' });

    expect(await screen.findByText(/couldn't load your history/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('points the empty state back at open requests, not at a new one', async () => {
    fetchRequests.mockResolvedValue(page([]));
    renderPortal(<PortalHistoryPage />, { path: '/portal/history' });

    expect(await screen.findByText('Nothing has been resolved yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Track your open requests' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Submit a request' })).not.toBeInTheDocument();
  });

  it('shows the resolution date in place of last activity', async () => {
    fetchRequests.mockResolvedValue(page([resolved()]));
    renderPortal(<PortalHistoryPage />, { path: '/portal/history' });

    expect(await screen.findByText('Refund for duplicate charge')).toBeInTheDocument();
    expect(screen.getByText(/^Resolved /)).toBeInTheDocument();
    expect(screen.queryByText(/Last activity/)).not.toBeInTheDocument();
  });

  it('paginates through the URL', async () => {
    const user = userEvent.setup();
    fetchRequests.mockResolvedValue(page([resolved()], { current_page: 1, last_page: 2, total: 21 }));
    renderPortal(<PortalHistoryPage />, { path: '/portal/history' });

    await screen.findByText('Refund for duplicate charge');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(fetchRequests).toHaveBeenCalledWith('past', 2));
  });
});
