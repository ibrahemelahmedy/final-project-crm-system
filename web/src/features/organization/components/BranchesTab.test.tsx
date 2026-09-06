import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BranchesTab } from './BranchesTab';
import { I18nextProvider, i18n } from '../../../i18n';
import { api } from '../../../lib/api';
import type { Branch } from '../model/types';

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api');
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});

const get = api.get as ReturnType<typeof vi.fn>;

function branch(overrides: Partial<Branch> = {}): Branch {
  return {
    id: 1,
    name: 'Downtown HQ',
    region: 'Riyadh, SA',
    timezone: 'Asia/Riyadh',
    is_active: true,
    agent_count: 12,
    created_at: null,
    ...overrides,
  };
}

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <BranchesTab />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('BranchesTab', () => {
  it('renders a skeleton while loading', () => {
    get.mockReturnValue(new Promise(() => {}));
    renderTab();

    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');
  });

  it('renders an error state with a retry action', async () => {
    get.mockRejectedValue(new Error('network'));
    renderTab();

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders the empty state copy on an empty list', async () => {
    get.mockResolvedValue({ data: { data: [] } });
    renderTab();

    expect(await screen.findByText('No additional branches yet')).toBeInTheDocument();
    expect(
      screen.getByText(
        'All tickets and agents currently stay assigned to your default branch. Add a branch to start organizing your team by location.'
      )
    ).toBeInTheDocument();
  });

  it('renders a null region as an em dash and the real agent count', async () => {
    get.mockResolvedValue({
      data: { data: [branch({ region: null, agent_count: 3, name: 'Remote Team' })] },
    });
    renderTab();

    expect(await screen.findByText('Remote Team')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
