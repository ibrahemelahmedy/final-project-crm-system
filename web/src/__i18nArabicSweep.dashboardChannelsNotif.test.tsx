import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from './i18n/instance';
import { AdminDashboardPage } from './features/agent-dashboard/pages/AdminDashboardPage';
import { ChannelsPage } from './features/channels/pages/ChannelsPage';
import { NotificationPanel } from './features/notifications/components/NotificationPanel';
import { NotificationsHarness } from './features/notifications/testUtils';
import { makeNotification, makePage as makeNotifPage } from './features/notifications/testFixtures';
import * as notificationsApi from './features/notifications/api/notificationsApi';
import { api } from './lib/api';
import type { ChannelOverview } from './features/channels/model/channel';

vi.mock('./lib/api', async () => {
  const actual = await vi.importActual('./lib/api');
  return { ...actual, api: { get: vi.fn(), post: vi.fn() } };
});
vi.mock('./features/notifications/api/notificationsApi');

vi.mock('./features/auth/AuthContext', async () => {
  const actual = await vi.importActual('./features/auth/AuthContext');
  return {
    ...actual,
    useAuth: () => ({
      user: { id: 1, name: 'Sarah Ahmed', role: 'agent', role_label: 'Agent', home_route: '/dashboard' },
      status: 'authenticated',
    }),
  };
});

const get = api.get as ReturnType<typeof vi.fn>;
const notifMocked = notificationsApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

afterEach(async () => {
  await i18n.changeLanguage('en');
  vi.clearAllMocks();
});

describe('Admin Dashboard — Arabic chrome sweep', () => {
  it('renders no English chrome string under ar', async () => {
    await i18n.changeLanguage('ar');
    get.mockResolvedValue({ data: { user_count: 14, active_sla_rule_count: 4, audit_log_count: 231 } });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminDashboardPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
    await waitFor(() => expect((document.body.textContent ?? '').length).toBeGreaterThan(20));
    const body = document.body.textContent ?? '';
    const CHROME = [
      'Admin overview', 'Platform configuration and oversight', 'User Management',
      'Manage users', 'SLA Rule Configuration', 'Configure rules', 'Audit Log', 'View log',
      'internal user', 'active rule', 'recorded event',
    ];
    const hits = CHROME.filter((s) => body.includes(s));
    expect(hits, `English chrome leaked under ar: ${hits.join(', ')}`).toEqual([]);
  });
});

describe('Channels — Arabic chrome sweep', () => {
  it('renders no English chrome string under ar', async () => {
    await i18n.changeLanguage('ar');
    const payload: ChannelOverview = {
      data: [
        { value: 'email', label_key: 'channels.email.label', status: 'not_connected', ticket_count: 144 },
        { value: 'whatsapp', label_key: 'channels.whatsapp.label', status: 'not_connected', ticket_count: 0 },
      ],
      meta: { period: '30d', from: '2026-07-30', to: '2026-08-28', total_tickets: 144, has_tickets: true },
    };
    get.mockResolvedValue({ data: payload });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ChannelsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
    await waitFor(() => expect((document.body.textContent ?? '').length).toBeGreaterThan(20));
    const body = document.body.textContent ?? '';
    const CHROME = [
      'Channels', 'Ticket origin by channel', 'Email', 'WhatsApp', 'Live chat', 'SMS',
      'Web forms', 'Not connected', 'tickets', 'No tickets this period', 'Count unavailable',
      "couldn't load", 'Retry', 'Last 7 days', 'Last 30 days', 'Last 90 days',
      'Tickets arrive via email', 'Requires a WhatsApp',
    ];
    const hits = CHROME.filter((s) => body.includes(s));
    expect(hits, `English chrome leaked under ar: ${hits.join(', ')}`).toEqual([]);
  });
});

describe('Notification Panel — Arabic chrome sweep', () => {
  it('renders no English chrome string under ar (populated + unread)', async () => {
    await i18n.changeLanguage('ar');
    notifMocked.fetchNotifications.mockResolvedValue(
      makeNotifPage([makeNotification({ read_at: null, source_available: false })])
    );
    render(
      <NotificationsHarness>
        <NotificationPanel />
      </NotificationsHarness>
    );
    await waitFor(() => expect((document.body.textContent ?? '').length).toBeGreaterThan(20));
    const body = document.body.textContent ?? '';
    const CHROME = [
      'Notifications', 'Mark all as read', "Couldn't load notifications",
      'Check your connection', 'Retry', "You're all caught up",
      'No notifications right now', 'View all notifications', 'No longer available',
    ];
    const hits = CHROME.filter((s) => body.includes(s));
    expect(hits, `English chrome leaked under ar: ${hits.join(', ')}`).toEqual([]);
  });

  it('renders no English chrome string under ar (empty state)', async () => {
    await i18n.changeLanguage('ar');
    notifMocked.fetchNotifications.mockResolvedValue(makeNotifPage([]));
    render(
      <NotificationsHarness>
        <NotificationPanel />
      </NotificationsHarness>
    );
    await waitFor(() => expect((document.body.textContent ?? '').length).toBeGreaterThan(20));
    const body = document.body.textContent ?? '';
    const CHROME = ["You're all caught up", 'No notifications right now — check back later.'];
    const hits = CHROME.filter((s) => body.includes(s));
    expect(hits, `English chrome leaked under ar: ${hits.join(', ')}`).toEqual([]);
  });
});
