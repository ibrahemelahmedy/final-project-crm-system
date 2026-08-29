import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChannelsPage } from './ChannelsPage';
import { api } from '../../../lib/api';
import type { ChannelOverview } from '../model/channel';

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api');
  return { ...actual, api: { get: vi.fn() } };
});

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'Sarah Ahmed', role: 'agent', role_label: 'Agent', home_route: '/dashboard' },
    status: 'authenticated',
  }),
}));

const get = api.get as ReturnType<typeof vi.fn>;

function payload(overrides: Partial<ChannelOverview> = {}): ChannelOverview {
  return {
    data: [
      { value: 'email', label_key: 'channels.email.label', status: 'not_connected', ticket_count: 144 },
      { value: 'whatsapp', label_key: 'channels.whatsapp.label', status: 'not_connected', ticket_count: 56 },
      { value: 'chat', label_key: 'channels.chat.label', status: 'not_connected', ticket_count: 88 },
      { value: 'sms', label_key: 'channels.sms.label', status: 'not_connected', ticket_count: 22 },
      { value: 'web_form', label_key: 'channels.web_form.label', status: 'not_connected', ticket_count: 30 },
    ],
    meta: {
      period: '30d',
      from: '2026-07-29T00:00:00Z',
      to: '2026-08-28T00:00:00Z',
      total_tickets: 340,
      has_tickets: true,
    },
    ...overrides,
  };
}

function renderPage(path = '/channels') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <ChannelsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ChannelsPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders a skeleton while loading', () => {
    get.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('status', { name: /loading channels/i })).toBeInTheDocument();
  });

  it('renders the five channels with their real counts on success', async () => {
    get.mockResolvedValue({ data: payload() });
    renderPage();

    expect(await screen.findByText('Email')).toBeInTheDocument();
    for (const name of ['Email', 'WhatsApp', 'Live chat', 'SMS', 'Web forms']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    expect(screen.getByText('144')).toBeInTheDocument();
    expect(screen.getAllByText('Not connected')).toHaveLength(5);
    expect(get).toHaveBeenCalledWith('/channels/overview', expect.objectContaining({ params: { period: '30d' } }));
  });

  it('renders the empty state with no literal 0 in any card', async () => {
    get.mockResolvedValue({
      data: payload({
        data: payload().data.map((c) => ({ ...c, ticket_count: 0 })),
        meta: { ...payload().meta, total_tickets: 0, has_tickets: false },
      }),
    });
    renderPage();

    expect(await screen.findAllByText('No tickets this period')).toHaveLength(5);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('on a failed count still lists five channels and offers a working Retry', async () => {
    get.mockRejectedValueOnce({ response: { status: 500 } }).mockResolvedValueOnce({ data: payload() });
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(/Ticket counts couldn't load/i);
    for (const name of ['Email', 'WhatsApp', 'Live chat', 'SMS', 'Web forms']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    expect(screen.getAllByText('Count unavailable')).toHaveLength(5);

    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.getByText('144')).toBeInTheDocument());
  });

  it('renders a card for an unknown channel value with a generic help line, never a crash', async () => {
    get.mockResolvedValue({
      data: payload({
        data: [
          ...payload().data,
          { value: 'carrier_pigeon', label_key: 'channels.carrier_pigeon.label', status: 'not_connected', ticket_count: 3 },
        ],
      }),
    });
    renderPage();

    expect(await screen.findByText('Carrier Pigeon')).toBeInTheDocument();
    expect(screen.getByText(/Connect this channel to start collecting tickets/i)).toBeInTheDocument();
  });
});
