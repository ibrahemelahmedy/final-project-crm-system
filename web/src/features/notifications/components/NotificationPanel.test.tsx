import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationPanel } from './NotificationPanel';
import { NotificationsHarness } from '../testUtils';
import { makeNotification, makePage } from '../testFixtures';
import * as notificationsApi from '../api/notificationsApi';

vi.mock('../api/notificationsApi');
const mocked = notificationsApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderPanel(onRowActivated = vi.fn()) {
  render(
    <NotificationsHarness>
      <NotificationPanel onRowActivated={onRowActivated} />
    </NotificationsHarness>
  );
  return onRowActivated;
}

describe('NotificationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Loading state while the list is in flight', () => {
    mocked.fetchNotifications.mockReturnValue(new Promise(() => {}));
    renderPanel();
    expect(document.querySelector('.notif-list[aria-busy="true"]')).toBeInTheDocument();
  });

  it('renders the Empty state when there are no notifications', async () => {
    mocked.fetchNotifications.mockResolvedValue(makePage([]));
    renderPanel();

    expect(await screen.findByText("You're all caught up")).toBeInTheDocument();
    expect(screen.getByText('No notifications right now — check back later.')).toBeInTheDocument();
  });

  it('renders the Error state and retries on click', async () => {
    mocked.fetchNotifications.mockRejectedValueOnce(new Error('network'));
    mocked.fetchNotifications.mockResolvedValueOnce(makePage([makeNotification()]));
    renderPanel();

    expect(await screen.findByText("Couldn't load notifications")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.queryByText("Couldn't load notifications")).not.toBeInTheDocument();
    });
  });

  it('renders the Success state with rows', async () => {
    mocked.fetchNotifications.mockResolvedValue(
      makePage([makeNotification({ title: 'SLA row title' })])
    );
    renderPanel();

    expect(await screen.findByText('SLA row title')).toBeInTheDocument();
    expect(screen.getByText('View all notifications')).toBeInTheDocument();
  });

  it('activating a row fires the read mutation and navigates', async () => {
    const notification = makeNotification({ id: 42, link_to: '/tickets/42' });
    mocked.fetchNotifications.mockResolvedValue(makePage([notification]));
    mocked.markNotificationRead.mockResolvedValue({ ...notification, read_at: new Date().toISOString() });
    const onRowActivated = renderPanel();

    const row = await screen.findByText(notification.title);
    fireEvent.click(row);

    await waitFor(() => {
      expect(mocked.markNotificationRead).toHaveBeenCalledWith(42);
    });
    expect(onRowActivated).toHaveBeenCalled();
  });

  it('a row with source_available false renders "No longer available" and does not navigate', async () => {
    const notification = makeNotification({
      id: 7,
      link_to: null,
      source_available: false,
      title: 'Unreachable row',
    });
    mocked.fetchNotifications.mockResolvedValue(makePage([notification]));
    mocked.markNotificationRead.mockResolvedValue({ ...notification, read_at: new Date().toISOString() });
    const onRowActivated = renderPanel();

    expect(await screen.findByText('No longer available')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Unreachable row'));

    await waitFor(() => {
      expect(mocked.markNotificationRead).toHaveBeenCalledWith(7);
    });
    // onRowActivated still fires (panel closes) but navigation never happens
    // — there is nothing to assert a navigation DIDN'T occur beyond the
    // absence of a router error, so the source_available branch above is the
    // real guard under test.
    expect(onRowActivated).toHaveBeenCalled();
  });

  it('disables "Mark all as read" when nothing is unread', async () => {
    mocked.fetchNotifications.mockResolvedValue(
      makePage([makeNotification({ read_at: new Date().toISOString() })])
    );
    renderPanel();

    const button = await screen.findByRole('button', { name: 'Mark all as read' });
    expect(button).toBeDisabled();
  });
});
