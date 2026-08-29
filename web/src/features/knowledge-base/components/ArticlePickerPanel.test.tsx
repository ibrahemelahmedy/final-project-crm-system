import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ArticlePickerPanel } from './ArticlePickerPanel';
import * as kbApi from '../api/kbApi';
import { KbHarness } from '../testUtils';
import { agentUser, makeSummary } from '../testFixtures';

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api');
  return { ...actual, api: { post: vi.fn() } };
});

vi.mock('../api/kbApi');

const mocked = kbApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderPicker(onInsert = vi.fn(), onClose?: () => void) {
  render(
    <MemoryRouter>
      <KbHarness user={agentUser}>
        <ArticlePickerPanel onInsert={onInsert} onClose={onClose} />
      </KbHarness>
    </MemoryRouter>
  );
  return onInsert;
}

describe('ArticlePickerPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls onInsert with exactly the agreed Markdown reference format', async () => {
    // THE contract Story 05 consumes: [<title>](/knowledge-base/<slug>).
    mocked.searchArticles.mockResolvedValue({
      data: [makeSummary()],
      query: 'password',
    });

    const onInsert = renderPicker();

    fireEvent.change(await screen.findByLabelText('Search knowledge base articles'), {
      target: { value: 'password' },
    });

    const result = await screen.findByRole('button', { name: /How to reset your password/ });
    fireEvent.click(result);

    expect(onInsert).toHaveBeenCalledWith(
      '[How to reset your password](/knowledge-base/how-to-reset-your-password)'
    );
    expect(onInsert).toHaveBeenCalledTimes(1);
  });

  it('renders the Empty state quoting the query when nothing matches', async () => {
    mocked.searchArticles.mockResolvedValue({ data: [], query: 'zzzz' });

    renderPicker();

    fireEvent.change(await screen.findByLabelText('Search knowledge base articles'), {
      target: { value: 'zzzz' },
    });

    // Never a blank list, and never a spinner that resolves to nothing.
    expect(await screen.findByText(/No articles match/)).toHaveTextContent('zzzz');
    expect(screen.getByText(/Try a broader search/)).toBeInTheDocument();
  });

  it('does not search before anything is typed', async () => {
    renderPicker();

    expect(await screen.findByText(/Type to search the Knowledge Base/)).toBeInTheDocument();
    expect(mocked.searchArticles).not.toHaveBeenCalled();
  });

  it('labels an unpublished result so an editor can tell draft guidance apart', async () => {
    mocked.searchArticles.mockResolvedValue({
      data: [makeSummary({ status: 'draft', status_label: 'Draft' })],
      query: 'password',
    });

    renderPicker();

    fireEvent.change(await screen.findByLabelText('Search knowledge base articles'), {
      target: { value: 'password' },
    });

    expect(await screen.findByText('Draft')).toBeInTheDocument();
  });

  it('closes after inserting when a close handler is supplied', async () => {
    mocked.searchArticles.mockResolvedValue({ data: [makeSummary()], query: 'password' });
    const onClose = vi.fn();

    renderPicker(vi.fn(), onClose);

    fireEvent.change(await screen.findByLabelText('Search knowledge base articles'), {
      target: { value: 'password' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /How to reset your password/ }));

    expect(onClose).toHaveBeenCalled();
  });

  it('renders a retryable Error state', async () => {
    mocked.searchArticles.mockRejectedValue(new Error('offline'));

    renderPicker();

    fireEvent.change(await screen.findByLabelText('Search knowledge base articles'), {
      target: { value: 'password' },
    });

    expect(await screen.findByText('Articles could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByText(/offline/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('announces the result count for screen-reader users', async () => {
    mocked.searchArticles.mockResolvedValue({
      data: [makeSummary(), makeSummary({ id: 2, slug: 'two', title: 'Second' })],
      query: 'password',
    });

    renderPicker();

    fireEvent.change(await screen.findByLabelText('Search knowledge base articles'), {
      target: { value: 'password' },
    });

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('2 articles found');
    });
  });
});
