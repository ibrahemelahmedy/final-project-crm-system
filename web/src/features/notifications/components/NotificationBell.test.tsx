import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationBell } from './NotificationBell';
import { NotificationsHarness } from '../testUtils';
import { makeNotification, makePage } from '../testFixtures';
import * as notificationsApi from '../api/notificationsApi';

vi.mock('../api/notificationsApi');
const mocked = notificationsApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderBell() {
  return render(
    <NotificationsHarness>
      <NotificationBell />
    </NotificationsHarness>
  );
}

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.fetchNotifications.mockResolvedValue(makePage([makeNotification()]));
  });

  it('hides the badge when the unread count is zero', async () => {
    mocked.fetchUnreadCount.mockResolvedValue(0);
    renderBell();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Notifications, no unread' })).toBeInTheDocument();
    });
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('shows the exact number below ten', async () => {
    mocked.fetchUnreadCount.mockResolvedValue(3);
    renderBell();

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Notifications, 3 unread' })).toBeInTheDocument();
  });

  it('shows 9+ above nine but still announces the exact count', async () => {
    mocked.fetchUnreadCount.mockResolvedValue(14);
    renderBell();

    await waitFor(() => {
      expect(screen.getByText('9+')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Notifications, 14 unread' })).toBeInTheDocument();
  });

  it('Escape closes the panel and returns focus to the bell', async () => {
    mocked.fetchUnreadCount.mockResolvedValue(1);
    renderBell();

    const trigger = await screen.findByRole('button', { name: /Notifications/ });
    fireEvent.click(trigger);

    await screen.findByRole('dialog', { name: 'Notifications' });

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Notifications' })).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });

  it('opens the panel with aria-expanded true', async () => {
    mocked.fetchUnreadCount.mockResolvedValue(0);
    renderBell();

    const trigger = await screen.findByRole('button', { name: /Notifications/ });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await screen.findByRole('dialog', { name: 'Notifications' });
  });
});
