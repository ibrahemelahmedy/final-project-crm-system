import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DeadLetterPanel } from './DeadLetterPanel';
import { I18nextProvider, i18n } from '../../../i18n';
import { api } from '../../../lib/api';
import type { Integration } from '../model/types';

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api');
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});

const get = api.get as ReturnType<typeof vi.fn>;
const post = api.post as ReturnType<typeof vi.fn>;

function integration(deadLetterCount = 2): Integration {
  return {
    type: 'erp',
    label_key: 'integrations.type.erp.label',
    status: 'connected',
    endpoint_url: 'https://api.example.com/v1',
    secret_last_four: '1234',
    last_checked_at: null,
    last_check_failed_at: null,
    last_error_key: null,
    sync: {
      inbound_enabled: false,
      inbound_url: null,
      inbound_field_map: {},
      conflict_rules: {},
      last_inbound_sync_at: null,
      outbound_enabled: true,
      outbound_url: 'https://example.com/hook',
      outbound_events: ['ticket.created'],
      last_outbound_sync_at: null,
      dead_letter_count: deadLetterCount,
    },
  };
}

function renderPanel(deadLetterCount = 2) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <DeadLetterPanel integration={integration(deadLetterCount)} />
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue({ data: { data: [], meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 } } });
});

describe('DeadLetterPanel', () => {
  it('shows the dead-letter count banner', () => {
    renderPanel(3);
    expect(screen.getByText('3 failed deliveries')).toBeInTheDocument();
  });

  it('Retry all opens the confirm dialog and calls the mutation', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ data: { requeued: 3 } });
    renderPanel(3);

    await user.click(screen.getByRole('button', { name: 'Retry all' }));
    expect(await screen.findByText('Retry all failed deliveries?')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Retry all' })[1]);
    expect(post).toHaveBeenCalledWith('/admin/integrations/erp/outbox/retry');
  });
});
