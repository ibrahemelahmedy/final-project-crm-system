import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SyncRunHistory } from './SyncRunHistory';
import { I18nextProvider, i18n } from '../../../i18n';
import { api } from '../../../lib/api';
import type { Paginated, SyncRun } from '../model/types';

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api');
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});

const get = api.get as ReturnType<typeof vi.fn>;

function run(overrides: Partial<SyncRun> = {}): SyncRun {
  return {
    id: 1,
    direction: 'inbound',
    trigger: 'manual',
    status: 'success',
    records_read: 3,
    records_created: 3,
    records_updated: 0,
    records_skipped: 0,
    records_failed: 0,
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    duration_seconds: 2,
    error_key: null,
    errors: [],
    ...overrides,
  };
}

function page(runs: SyncRun[]): Paginated<SyncRun> {
  return { data: runs, meta: { current_page: 1, last_page: 1, per_page: 20, total: runs.length } };
}

function renderHistory() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <SyncRunHistory type="erp" />
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SyncRunHistory', () => {
  it('renders the loading state', () => {
    get.mockReturnValue(new Promise(() => {}));
    renderHistory();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders the error state with a retry button', async () => {
    get.mockRejectedValue(new Error('boom'));
    renderHistory();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('renders the empty state', async () => {
    get.mockResolvedValue({ data: page([]) });
    renderHistory();

    expect(await screen.findByText('No runs yet')).toBeInTheDocument();
  });

  it('renders inbound labels for an inbound run', async () => {
    get.mockResolvedValue({ data: page([run({ direction: 'inbound' })]) });
    renderHistory();

    expect(await screen.findByText('Received')).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });

  it('renders outbound labels for an outbound run', async () => {
    get.mockResolvedValue({ data: page([run({ direction: 'outbound', records_updated: 0 })]) });
    renderHistory();

    expect(await screen.findByText('Delivered')).toBeInTheDocument();
    expect(screen.getByText('Dead-lettered')).toBeInTheDocument();
  });

  it('a failed run expands its errors', async () => {
    const user = userEvent.setup();
    get.mockResolvedValue({
      data: page([
        run({
          status: 'partial',
          records_failed: 1,
          errors: [{ external_id: 'ext-1', field: 'name', reason_key: 'integrations.sync.error.missing_name', detail: null }],
        }),
      ]),
    });
    renderHistory();

    const toggle = await screen.findByRole('button', { name: 'Show 1 errors' });
    await user.click(toggle);

    expect(await screen.findByText('ext-1')).toBeInTheDocument();
  });
});
