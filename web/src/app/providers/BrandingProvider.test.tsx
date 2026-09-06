import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrandingProvider } from './BrandingProvider';
import { api } from '../../lib/api';

vi.mock('../../features/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'Sarah Ahmed', role: 'administrator', role_label: 'Administrator', home_route: '/dashboard' },
    status: 'authenticated',
  }),
}));

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual('../../lib/api');
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});

const get = api.get as ReturnType<typeof vi.fn>;

function renderProvider() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BrandingProvider>
        <div>content</div>
      </BrandingProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  document.documentElement.style.removeProperty('--brand-primary');
});

afterEach(() => {
  document.documentElement.style.removeProperty('--brand-primary');
});

describe('BrandingProvider', () => {
  it('sets --brand-primary on <html> when a color is stored', async () => {
    get.mockResolvedValue({ data: { data: { primary_color: '#0E7490', logo_url: null, updated_at: null } } });
    renderProvider();

    await waitFor(() =>
      expect(document.documentElement.style.getPropertyValue('--brand-primary')).toBe('#0E7490')
    );
  });

  it('removes --brand-primary when the stored color is null', async () => {
    document.documentElement.style.setProperty('--brand-primary', '#0E7490');
    get.mockResolvedValue({ data: { data: { primary_color: null, logo_url: null, updated_at: null } } });
    renderProvider();

    await waitFor(() =>
      expect(document.documentElement.style.getPropertyValue('--brand-primary')).toBe('')
    );
  });

  it('renders children with no loading gate even when the query fails', async () => {
    get.mockRejectedValue(new Error('network'));
    const { findByText } = renderProvider();

    expect(await findByText('content')).toBeInTheDocument();
  });
});
