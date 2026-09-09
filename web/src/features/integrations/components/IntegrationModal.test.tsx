import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { IntegrationModal } from './IntegrationModal';
import { I18nextProvider, i18n } from '../../../i18n';
import { api } from '../../../lib/api';
import type { Integration } from '../model/types';

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api');
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});

const post = api.post as ReturnType<typeof vi.fn>;
const get = api.get as ReturnType<typeof vi.fn>;

function integration(overrides: Partial<Integration> = {}): Integration {
  return {
    type: 'erp',
    label_key: 'integrations.type.erp.label',
    status: 'not_connected',
    endpoint_url: null,
    secret_last_four: null,
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

function renderModal(props: Partial<React.ComponentProps<typeof IntegrationModal>> = {}, initialEntries = ['/integrations?configure=erp']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const onClose = props.onClose ?? vi.fn();
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={initialEntries}>
          <IntegrationModal integration={props.integration ?? integration()} onClose={onClose} />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('IntegrationModal', () => {
  it('disables Test connection and Save, and shows Testing…, while the test is pending', async () => {
    const user = userEvent.setup();
    let resolveTest: (v: unknown) => void = () => {};
    post.mockReturnValue(new Promise((resolve) => { resolveTest = resolve; }));
    renderModal();

    await user.type(screen.getByLabelText('Endpoint URL'), 'https://api.example-erp.test/v1');
    await user.type(screen.getByLabelText('API key / secret'), 'sk_test_12345678');
    await user.click(screen.getByRole('button', { name: 'Test connection' }));

    expect(await screen.findByRole('button', { name: 'Testing…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    resolveTest({ data: { ok: true, error_key: null } });
  });

  it('renders the failure banner and leaves Save enabled when the test fails', async () => {
    const user = userEvent.setup();
    post.mockResolvedValue({ data: { ok: false, error_key: 'integrations.error.unreachable' } });
    renderModal();

    await user.type(screen.getByLabelText('Endpoint URL'), 'https://api.example-erp.test/v1');
    await user.type(screen.getByLabelText('API key / secret'), 'sk_test_12345678');
    await user.click(screen.getByRole('button', { name: 'Test connection' }));

    expect(
      await screen.findByText("Couldn't reach the endpoint. Check the URL and API key, then try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('has no Disconnect control for a not_connected integration', () => {
    renderModal({ integration: integration({ status: 'not_connected' }) });

    expect(screen.queryByRole('button', { name: 'Disconnect' })).not.toBeInTheDocument();
  });

  it('opens a confirmation naming the integration when Disconnect is pressed on a connected one', async () => {
    const user = userEvent.setup();
    renderModal({ integration: integration({ status: 'connected', endpoint_url: 'https://api.example-erp.test/v1' }) });

    await user.click(screen.getByRole('button', { name: 'Disconnect' }));

    expect(await screen.findByText('Disconnect ERP?')).toBeInTheDocument();
  });

  describe('Story 25 (WIS-24) tabs', () => {
    it('renders the three tabs, Connection active by default', () => {
      renderModal({ integration: integration({ status: 'connected' }) });

      const tabs = screen.getAllByRole('tab');
      expect(tabs.map((t) => t.textContent)).toEqual(['Connection', 'Sync', 'History']);
      expect(screen.getByRole('tab', { name: 'Connection' })).toHaveAttribute('aria-selected', 'true');
    });

    it('disables Sync and History for a not_connected integration', () => {
      renderModal({ integration: integration({ status: 'not_connected' }) });

      expect(screen.getByRole('tab', { name: 'Sync' })).toBeDisabled();
      expect(screen.getByRole('tab', { name: 'History' })).toBeDisabled();
    });

    it('round-trips the active tab through the URL', async () => {
      const user = userEvent.setup();
      get.mockResolvedValue({ data: { data: [], meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 } } });
      renderModal({ integration: integration({ status: 'connected' }) }, ['/integrations?configure=erp&tab=history']);

      expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');

      await user.click(screen.getByRole('tab', { name: 'Connection' }));
      expect(screen.getByRole('tab', { name: 'Connection' })).toHaveAttribute('aria-selected', 'true');
    });

    it('every existing Connection-tab assertion still passes when Connection is the active tab', () => {
      renderModal({ integration: integration({ status: 'connected' }) });

      expect(screen.getByLabelText('Endpoint URL')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });
  });
});
