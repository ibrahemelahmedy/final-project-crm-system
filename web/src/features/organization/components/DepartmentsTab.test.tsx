import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DepartmentsTab } from './DepartmentsTab';
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

function mockGet(branches: Branch[], departments: unknown[] = []) {
  get.mockImplementation((url: string) => {
    if (url === '/admin/branches') return Promise.resolve({ data: { data: branches } });
    if (url === '/admin/departments') return Promise.resolve({ data: { data: departments } });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
}

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DepartmentsTab />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DepartmentsTab — no-branch-yet path', () => {
  it('renders the banner and a working Go to Branches link when branches is empty', async () => {
    mockGet([]);
    renderTab();

    expect(
      await screen.findByText('You need to add at least one branch before you can create a department.')
    ).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Go to Branches' });
    expect(link).toHaveAttribute('href', '/organization');
  });

  it('leaves + Add department enabled with no branches', async () => {
    mockGet([]);
    renderTab();

    const addButton = await screen.findByRole('button', { name: '+ Add department' });
    expect(addButton).toBeEnabled();
  });

  it('opens the modal with a disabled branch selector and a disabled submit when no branches exist', async () => {
    mockGet([]);
    renderTab();

    const addButton = await screen.findByRole('button', { name: '+ Add department' });
    await userEvent.click(addButton);

    const select = await screen.findByLabelText('Branch');
    expect(select).toBeDisabled();
    expect(screen.getByText('No branches available')).toBeInTheDocument();
    expect(screen.getByText('Add a branch first to assign this department.')).toBeInTheDocument();

    const saveButton = screen.getByRole('button', { name: 'Save department' });
    expect(saveButton).toBeDisabled();
  });

  it('shows no banner and an enabled, populated selector once a branch exists', async () => {
    mockGet([branch({ name: 'Downtown HQ' })]);
    renderTab();

    await screen.findByRole('button', { name: '+ Add department' });
    expect(
      screen.queryByText('You need to add at least one branch before you can create a department.')
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '+ Add department' }));

    const select = await screen.findByLabelText('Branch');
    expect(select).toBeEnabled();
    expect(screen.getByRole('option', { name: 'Downtown HQ' })).toBeInTheDocument();
  });
});
