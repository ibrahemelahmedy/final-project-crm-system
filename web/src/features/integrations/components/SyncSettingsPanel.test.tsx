import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SyncSettingsPanel } from './SyncSettingsPanel';
import { I18nextProvider, i18n } from '../../../i18n';
import { api } from '../../../lib/api';
import type { Integration } from '../model/types';

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api');
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});

const put = api.put as ReturnType<typeof vi.fn>;

function integration(overrides: Partial<Integration> = {}): Integration {
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
      outbound_enabled: false,
      outbound_url: null,
      outbound_events: [],
      last_outbound_sync_at: null,
      dead_letter_count: 0,
    },
    ...overrides,
  };
}

function renderPanel(props: Partial<Integration> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <SyncSettingsPanel integration={integration(props)} />
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SyncSettingsPanel', () => {
  it('renders the saved config', () => {
    renderPanel({
      sync: {
        inbound_enabled: true,
        inbound_url: 'https://api.example.com/customers',
        inbound_field_map: { external_id: 'id' },
        conflict_rules: {},
        last_inbound_sync_at: null,
        outbound_enabled: false,
        outbound_url: null,
        outbound_events: [],
        last_outbound_sync_at: null,
        dead_letter_count: 0,
      },
    });

    expect(screen.getByLabelText('Collection endpoint URL')).toHaveValue('https://api.example.com/customers');
  });

  it('toggling inbound enables the URL input', async () => {
    const user = userEvent.setup();
    renderPanel();

    const urlInput = screen.getByLabelText('Collection endpoint URL');
    expect(urlInput).toBeDisabled();

    await user.click(screen.getByLabelText('Enable inbound sync'));
    expect(urlInput).toBeEnabled();
  });

  it('Save calls saveSyncConfig with the built body', async () => {
    const user = userEvent.setup();
    put.mockResolvedValue({ data: { data: integration() } });
    renderPanel();

    await user.click(screen.getByLabelText('Enable outbound sync'));
    await user.type(screen.getByLabelText('Receiver URL'), 'https://example.com/hook');
    await user.click(screen.getByLabelText('Ticket created'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(put).toHaveBeenCalledWith(
      '/admin/integrations/erp/sync-config',
      expect.objectContaining({
        outbound_enabled: true,
        outbound_url: 'https://example.com/hook',
        outbound_events: ['ticket.created'],
      }),
    );
  });

  it('an invalid https URL blocks submit', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByLabelText('Enable outbound sync'));
    await user.type(screen.getByLabelText('Receiver URL'), 'http://not-https.example.com');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(put).not.toHaveBeenCalled();
  });
});
