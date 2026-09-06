import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrganizationPage } from './OrganizationPage';
import { I18nextProvider, i18n } from '../../../i18n';
import { api } from '../../../lib/api';

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api');
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});

const get = api.get as ReturnType<typeof vi.fn>;

function renderPage(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/organization/:tab?" element={<OrganizationPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  get.mockImplementation((url: string) => {
    if (url === '/admin/branches') return Promise.resolve({ data: { data: [] } });
    if (url === '/admin/departments') return Promise.resolve({ data: { data: [] } });
    if (url === '/admin/branding') {
      return Promise.resolve({ data: { data: { primary_color: null, logo_url: null, updated_at: null } } });
    }
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
});

describe('OrganizationPage', () => {
  it('renders three role="tab" links', async () => {
    renderPage('/organization');

    expect(await screen.findAllByRole('tab')).toHaveLength(3);
  });

  it('marks Branches as selected at /organization', async () => {
    renderPage('/organization');

    const tabs = await screen.findAllByRole('tab');
    const branchesTab = tabs.find((t) => t.textContent === 'Branches');
    expect(branchesTab).toHaveAttribute('aria-selected', 'true');
  });

  it('renders the branding form, not the branches table, at /organization/branding', async () => {
    renderPage('/organization/branding');

    expect(await screen.findByText('Primary color')).toBeInTheDocument();
    expect(screen.queryByText('No additional branches yet')).not.toBeInTheDocument();
  });

  it('redirects an unknown tab segment to /organization', async () => {
    renderPage('/organization/nonsense');

    // Branches tab content (the default) should render after the redirect.
    expect(await screen.findAllByRole('tab')).toHaveLength(3);
    const tabs = screen.getAllByRole('tab');
    const branchesTab = tabs.find((t) => t.textContent === 'Branches');
    expect(branchesTab).toHaveAttribute('aria-selected', 'true');
  });
});
