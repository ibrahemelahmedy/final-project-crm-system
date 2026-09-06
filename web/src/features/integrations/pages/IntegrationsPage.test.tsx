import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IntegrationsPage } from './IntegrationsPage';
import { I18nextProvider, i18n } from '../../../i18n';
import { api } from '../../../lib/api';
import type { Integration } from '../model/types';

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api');
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});

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
    ...overrides,
  };
}

const FIVE_TYPES: Integration[] = [
  integration({ type: 'erp' }),
  integration({ type: 'email', label_key: 'integrations.type.email.label' }),
  integration({ type: 'sms', label_key: 'integrations.type.sms.label' }),
  integration({ type: 'whatsapp', label_key: 'integrations.type.whatsapp.label' }),
  integration({ type: 'api_webhook', label_key: 'integrations.type.api_webhook.label' }),
];

function renderPage(path = '/integrations') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <IntegrationsPage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('IntegrationsPage', () => {
  it('renders all five cards in the order the API returns them', async () => {
    get.mockResolvedValue({ data: { data: FIVE_TYPES } });
    renderPage();

    const cards = await screen.findAllByRole('article');

    expect(cards).toHaveLength(5);
    expect(within(cards[0]).getByText('ERP')).toBeInTheDocument();
    expect(within(cards[4]).getByText('Custom API / Webhook')).toBeInTheDocument();
  });

  it('renders a skeleton while the request is pending', async () => {
    get.mockImplementation(() => new Promise(() => {}));
    renderPage();

    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(document.querySelector('.intg-grid')).toBeInTheDocument();
  });

  it('renders the error state with a working Retry', async () => {
    get.mockRejectedValue(new Error('Request failed with status code 500'));
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Could not load the integrations')).toBeInTheDocument();

    get.mockResolvedValue({ data: { data: FIVE_TYPES } });
    within(alert).getByRole('button', { name: 'Retry' }).click();

    expect(await screen.findAllByRole('article')).toHaveLength(5);
  });

  it('opens the modal from ?configure= on mount, and clears the param on close', async () => {
    get.mockResolvedValue({ data: { data: FIVE_TYPES } });
    renderPage('/integrations?configure=erp');

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Connect ERP')).toBeInTheDocument();
  });
});
