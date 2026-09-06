import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PortalRequestsPage } from './PortalRequestsPage';
import * as portalApi from '../api/portalApi';
import { renderPortal, ticket, page, pending } from '../testUtils';

vi.mock('../api/portalApi');

const fetchRequests = vi.mocked(portalApi.fetchPortalRequests);

beforeEach(() => {
  vi.clearAllMocks();
});

/** AC3 — "track requests": open tickets only, on its own route. */
describe('PortalRequestsPage', () => {
  it('asks the API for the OPEN scope, never past', async () => {
    fetchRequests.mockResolvedValue(page([ticket()]));
    renderPortal(<PortalRequestsPage />, { path: '/portal/requests' });

    await waitFor(() => expect(fetchRequests).toHaveBeenCalledWith('open', 1));
  });

  it('renders a skeleton while loading', () => {
    fetchRequests.mockReturnValue(pending());
    const { container } = renderPortal(<PortalRequestsPage />, { path: '/portal/requests' });

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it('renders a retryable error state', async () => {
    const user = userEvent.setup();
    fetchRequests.mockRejectedValue(new Error('boom'));
    renderPortal(<PortalRequestsPage />, { path: '/portal/requests' });

    expect(await screen.findByText(/couldn't load your requests/)).toBeInTheDocument();

    fetchRequests.mockResolvedValue(page([ticket()]));
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Payment not going through')).toBeInTheDocument();
  });

  it('offers "Submit a request" from the empty state', async () => {
    fetchRequests.mockResolvedValue(page([]));
    renderPortal(<PortalRequestsPage />, { path: '/portal/requests' });

    expect(await screen.findByText(/any open requests right now/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Submit a request' }).length).toBeGreaterThan(0);
  });

  it('lists each request with a text status label and last activity, not a resolution date', async () => {
    fetchRequests.mockResolvedValue(page([ticket()]));
    renderPortal(<PortalRequestsPage />, { path: '/portal/requests' });

    expect(await screen.findByText('Payment not going through')).toBeInTheDocument();
    // Colour is never the only signal: the label is real text.
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText(/Last activity/)).toBeInTheDocument();
    expect(screen.queryByText(/^Resolved /)).not.toBeInTheDocument();
    expect(screen.getByText(/2 messages/)).toBeInTheDocument();
  });

  it('links each row to that request', async () => {
    fetchRequests.mockResolvedValue(page([ticket({ id: 7 })]));
    renderPortal(<PortalRequestsPage />, { path: '/portal/requests' });

    const row = await screen.findByRole('link', { name: /Payment not going through/ });
    expect(row).toHaveAttribute('href', '/portal/requests/7');
  });

  it('keeps the page number in the URL', async () => {
    const user = userEvent.setup();
    fetchRequests.mockResolvedValue(page([ticket()], { current_page: 1, last_page: 3, total: 45 }));
    renderPortal(<PortalRequestsPage />, { path: '/portal/requests' });

    await screen.findByText('Payment not going through');
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(fetchRequests).toHaveBeenCalledWith('open', 2));
  });

  it('hides pagination on a single page', async () => {
    fetchRequests.mockResolvedValue(page([ticket()]));
    renderPortal(<PortalRequestsPage />, { path: '/portal/requests' });

    await screen.findByText('Payment not going through');
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  });
});
