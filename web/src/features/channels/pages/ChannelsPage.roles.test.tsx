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
const RELEASE_NOTICE = /Channel integrations are not available in this release/i;

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

const okPayload = {
  data: [
    { value: 'email', label_key: 'channels.email.label', status: 'not_connected', ticket_count: 5 },
    { value: 'whatsapp', label_key: 'channels.whatsapp.label', status: 'not_connected', ticket_count: 0 },
    { value: 'chat', label_key: 'channels.chat.label', status: 'not_connected', ticket_count: 0 },
    { value: 'sms', label_key: 'channels.sms.label', status: 'not_connected', ticket_count: 0 },
    { value: 'web_form', label_key: 'channels.web_form.label', status: 'not_connected', ticket_count: 0 },
  ],
  meta: { period: '30d', from: 'x', to: 'y', total_tickets: 5, has_tickets: true },
};

describe('ChannelsPage — role branching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    get.mockResolvedValue({ data: okPayload });
  });

  it('shows the release notice to an administrator', async () => {
    role = 'administrator';
    renderPage();
    expect(await screen.findByText('Email')).toBeInTheDocument();
    expect(screen.getByText(RELEASE_NOTICE)).toBeInTheDocument();
  });

  it('shows no release notice and no configuration affordance to an agent', async () => {
    role = 'agent';
    renderPage();
    expect(await screen.findByText('Email')).toBeInTheDocument();

    // No release notice.
    expect(screen.queryByText(RELEASE_NOTICE)).not.toBeInTheDocument();

    // Nothing that implies configuration: no links, no inputs, no combobox,
    // and no button that would connect or configure a channel.
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /connect|configure|integrat|set up|add channel/i })
    ).not.toBeInTheDocument();
  });

  it('shows a team lead a read-only screen with no release notice', async () => {
    role = 'team_lead';
    renderPage();
    expect(await screen.findByText('Email')).toBeInTheDocument();
    expect(screen.queryByText(RELEASE_NOTICE)).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
