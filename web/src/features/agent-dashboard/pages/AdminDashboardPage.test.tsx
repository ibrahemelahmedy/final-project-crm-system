import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminDashboardPage } from './AdminDashboardPage';
import { api } from '../../../lib/api';

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api');
  return { ...actual, api: { get: vi.fn() } };
});

const get = api.get as ReturnType<typeof vi.fn>;

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdminDashboardPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    get.mockResolvedValue({ data: { user_count: 14, active_sla_rule_count: 4, audit_log_count: 231 } });
  });

  it('renders no ticket table and links the three cards to their areas', async () => {
    renderPage();

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(/My Queue/)).not.toBeInTheDocument();

    expect(await screen.findByText('14 internal users')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /User Management/ })).toHaveAttribute('href', '/users');
    expect(screen.getByRole('link', { name: /SLA Rule Configuration/ })).toHaveAttribute('href', '/sla-rules');
    expect(screen.getByRole('link', { name: /Audit Log/ })).toHaveAttribute('href', '/users/audit-log');
  });
});
