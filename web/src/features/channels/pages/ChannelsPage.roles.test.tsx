import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChannelsPage } from './ChannelsPage';
import { api } from '../../../lib/api';

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api');
  return { ...actual, api: { get: vi.fn() } };
});

let role: 'agent' | 'team_lead' | 'administrator' = 'agent';
vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'X', role, role_label: role, home_route: '/dashboard' },
    status: 'authenticated',
  }),
}));

const get = api.get as ReturnType<typeof vi.fn>;

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/channels']}>
        <ChannelsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const overviewPayload = {
  data: [
    { value: 'email', label_key: 'channels.email.label', status: 'not_connected', ticket_count: 5, connection: null },
    { value: 'whatsapp', label_key: 'channels.whatsapp.label', status: 'not_connected', ticket_count: 0, connection: null },
    { value: 'chat', label_key: 'channels.chat.label', status: 'not_connected', ticket_count: 0, connection: null },
    { value: 'sms', label_key: 'channels.sms.label', status: 'not_connected', ticket_count: 0, connection: null },
    { value: 'web_form', label_key: 'channels.web_form.label', status: 'not_connected', ticket_count: 0, connection: null },
  ],
  meta: { period: '30d', from: 'x', to: 'y', total_tickets: 5, has_tickets: true },
};

const connectionsPayload = {
  data: [
    { channel: 'email', label_key: 'enums.channel.email', provider: null, status: 'not_connected', secret_last_four: null, config: {}, last_inbound_at: null, last_outbound_at: null, last_error_key: null, last_error_at: null },
    { channel: 'whatsapp', label_key: 'enums.channel.whatsapp', provider: null, status: 'not_connected', secret_last_four: null, config: {}, last_inbound_at: null, last_outbound_at: null, last_error_key: null, last_error_at: null },
    { channel: 'sms', label_key: 'enums.channel.sms', provider: null, status: 'not_connected', secret_last_four: null, config: {}, last_inbound_at: null, last_outbound_at: null, last_error_key: null, last_error_at: null },
    { channel: 'chat', label_key: 'enums.channel.chat', provider: null, status: 'not_connected', secret_last_four: null, config: {}, last_inbound_at: null, last_outbound_at: null, last_error_key: null, last_error_at: null },
  ],
};

describe('ChannelsPage — role branching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    get.mockImplementation((url: string) => {
      if (url === '/admin/channels') return Promise.resolve({ data: connectionsPayload });
      return Promise.resolve({ data: overviewPayload });
    });
  });

  it('shows an Administrator the channel connect panel', async () => {
    role = 'administrator';
    renderPage();
    expect(await screen.findByText('Email')).toBeInTheDocument();
    expect(await screen.findByText('Channel connections')).toBeInTheDocument();
    // One "Connect" action per connectable channel, proving the panel
    // actually rendered rows and not just its heading.
    expect((await screen.findAllByRole('button', { name: 'Connect' })).length).toBeGreaterThan(0);
  });

  it('shows an Agent no configuration affordance at all', async () => {
    role = 'agent';
    renderPage();
    expect(await screen.findByText('Email')).toBeInTheDocument();

    // No connect panel, and nothing that implies configuration: no links,
    // no inputs, no combobox, and no button that would connect, configure,
    // test or disconnect a channel.
    expect(screen.queryByText('Channel connections')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /connect|configure|reconnect|test|disconnect/i })
    ).not.toBeInTheDocument();
    // The admin-only query is never even issued for a non-admin.
    expect(get).not.toHaveBeenCalledWith('/admin/channels');
  });

  it('shows a Team Lead the same read-only screen with no configuration affordance', async () => {
    role = 'team_lead';
    renderPage();
    expect(await screen.findByText('Email')).toBeInTheDocument();
    expect(screen.queryByText('Channel connections')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /connect|configure|reconnect|test|disconnect/i })
    ).not.toBeInTheDocument();
    expect(get).not.toHaveBeenCalledWith('/admin/channels');
  });
});
