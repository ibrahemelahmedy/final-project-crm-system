import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QuickRepliesPage } from './QuickRepliesPage';
import { ProductivityHarness } from '../testUtils';
import { makeQuickReply } from '../testFixtures';
import * as quickRepliesApi from '../api/quickRepliesApi';

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api');
  return { ...actual, api: { post: vi.fn(), get: vi.fn(), patch: vi.fn() } };
});

vi.mock('../api/quickRepliesApi');

const mocked = quickRepliesApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

function paginated(items: ReturnType<typeof makeQuickReply>[]) {
  return {
    data: items,
    meta: { current_page: 1, last_page: 1, per_page: 10, from: items.length ? 1 : null, to: items.length || null, total: items.length },
    links: { first: null, last: null, prev: null, next: null },
  };
}

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location-search">{location.search}</span>;
}

function renderPage(initialEntries = ['/quick-replies']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ProductivityHarness>
        <QuickRepliesPage />
        <LocationProbe />
      </ProductivityHarness>
    </MemoryRouter>
  );
}

describe('QuickRepliesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the loading, then success state', async () => {
    mocked.fetchQuickReplies.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(paginated([makeQuickReply()])), 10))
    );
    renderPage();

    await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeTruthy());
    expect(await screen.findByText('Password reset instructions')).toBeInTheDocument();
  });

  it('renders the error state with Retry', async () => {
    mocked.fetchQuickReplies.mockRejectedValue(new Error('network'));
    renderPage();

    expect(await screen.findByText("Couldn't load quick replies")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('renders the empty state', async () => {
    mocked.fetchQuickReplies.mockResolvedValue(paginated([]));
    renderPage();

    expect(await screen.findByText('No quick replies yet')).toBeInTheDocument();
  });

  it('names the specific template in the archive confirmation', async () => {
    mocked.fetchQuickReplies.mockResolvedValue(paginated([makeQuickReply({ title: 'Refund policy explanation' })]));
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Archive' }));

    expect(await screen.findByText(/Archive "Refund policy explanation"\?/)).toBeInTheDocument();
  });

  it('writes category and status filters to URL search params, not component state', async () => {
    mocked.fetchQuickReplies.mockResolvedValue(paginated([makeQuickReply()]));
    renderPage();

    await screen.findByText('Password reset instructions');

    const statusSelect = screen.getAllByRole('combobox')[1];
    fireEvent.change(statusSelect, { target: { value: 'archived' } });

    await waitFor(() =>
      expect(screen.getByTestId('location-search').textContent).toContain('status=archived')
    );
  });
});
