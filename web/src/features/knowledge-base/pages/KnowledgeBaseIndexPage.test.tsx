import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { KnowledgeBaseIndexPage } from './KnowledgeBaseIndexPage';
import * as kbApi from '../api/kbApi';
import { KbHarness } from '../testUtils';
import {
agentUser,
  adminUser,
  categoriesFixture,
  makePage,
  makeSummary,
} from '../testFixtures';
import type { User } from '../../auth/AuthContext';

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api');
  return { ...actual, api: { post: vi.fn() } };
});

vi.mock('../api/kbApi');

const mocked = kbApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

// Echoes the live URL so a test can assert what actually landed in the address
// bar, rather than trusting the component's internal state.
const LocationProbe: React.FC = () => {
  const location = useLocation();
  return <div data-testid="location">{location.search}</div>;
};

function renderIndex(user: User = agentUser, initialEntry = '/knowledge-base') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <KbHarness user={user}>
        <Routes>
          <Route
            path="/knowledge-base"
            element={
              <>
                <KnowledgeBaseIndexPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </KbHarness>
    </MemoryRouter>
  );
}

describe('KnowledgeBaseIndexPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.listCategories.mockResolvedValue(categoriesFixture);
    mocked.listMostViewed.mockResolvedValue([makeSummary()]);
    mocked.listArticles.mockResolvedValue(makePage([makeSummary()]));
  });

  it('renders the category rail, the most-viewed list, and the article list', async () => {
    renderIndex();

    expect(await screen.findByRole('navigation', { name: 'Article categories' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /All Articles/ })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Account & Access/ })).toBeInTheDocument();

    expect(
      await screen.findByRole('navigation', { name: 'Most viewed articles' })
    ).toBeInTheDocument();

    expect(await screen.findByRole('table', { name: 'Knowledge Base articles' })).toBeInTheDocument();
    expect(screen.getAllByText('How to reset your password').length).toBeGreaterThan(0);
  });

  // ---- The four required async states -------------------------------------

  it('renders the Loading state while the list is in flight', async () => {
    // A never-resolving promise holds the query pending. findBy, not getBy —
    // the harness signs the user in through an async effect, so nothing is
    // mounted on the first synchronous tick.
    mocked.listArticles.mockReturnValue(new Promise(() => {}));
    renderIndex();
    expect(await screen.findByRole('table', { name: 'Loading' })).toHaveAttribute(
      'aria-busy',
      'true'
    );
  });

  it('renders the Error state with a retry that refetches', async () => {
    mocked.listArticles.mockRejectedValue(new Error('boom'));
    renderIndex();

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    // Never a raw stack or error.message (brief.md line 185).
    expect(screen.queryByText(/boom/)).not.toBeInTheDocument();

    mocked.listArticles.mockResolvedValue(makePage([makeSummary()]));
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('table', { name: 'Knowledge Base articles' })).toBeInTheDocument();
  });

  it('renders the Empty state when the KB has no articles at all', async () => {
    mocked.listArticles.mockResolvedValue(makePage([]));
    renderIndex();

    expect(await screen.findByText('No articles yet')).toBeInTheDocument();
  });

  it('renders the Success state with a row per article', async () => {
    mocked.listArticles.mockResolvedValue(
      makePage([makeSummary(), makeSummary({ id: 2, slug: 'second', title: 'Second article' })])
    );
    renderIndex();

    expect(await screen.findByText('Second article')).toBeInTheDocument();
  });

  // ---- The Empty state suggests broadening, and quotes the query -----------

  it('suggests a broader search and echoes the query when nothing matches', async () => {
    mocked.listArticles.mockResolvedValue(makePage([]));
    renderIndex(agentUser, '/knowledge-base?q=zzzz');

    expect(await screen.findByText(/No articles match/)).toHaveTextContent('zzzz');
    expect(screen.getByText(/Try a broader search/)).toBeInTheDocument();
    // Never a blank list.
    expect(screen.queryByRole('table', { name: 'Knowledge Base articles' })).not.toBeInTheDocument();
  });

  // ---- URL search-param state ---------------------------------------------

  it('writes the selected category to the URL', async () => {
    renderIndex();

    fireEvent.click(await screen.findByRole('button', { name: /Account & Access/ }));

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toContain('category%5B%5D=account-access');
    });
  });

  it('writes the typed query to the URL', async () => {
    renderIndex();

    fireEvent.change(await screen.findByLabelText('Search articles'), {
      target: { value: 'invoice' },
    });

    await waitFor(
      () => {
        expect(screen.getByTestId('location').textContent).toContain('q=invoice');
      },
      { timeout: 2000 }
    );
  });

  it('restores category and query from the URL on load, so a reload survives', async () => {
    renderIndex(agentUser, '/knowledge-base?q=invoice&category[]=billing');

    await waitFor(() => {
      expect(mocked.listArticles).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'invoice', category: ['billing'] })
      );
    });

    // And the rail reflects it rather than showing "All Articles" selected.
    const billing = await screen.findByRole('button', { name: /Billing/ });
    expect(billing).toHaveAttribute('aria-current', 'true');
  });

  it('sends the sort column to the server and reflects it in the URL', async () => {
    renderIndex();

    fireEvent.click(await screen.findByRole('button', { name: /ARTICLE/ }));

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toContain('sort=title');
    });
  });

  // ---- Editor-only affordances --------------------------------------------

  it('hides New Article from an Agent and shows it to an editor', async () => {
    renderIndex(agentUser);
    await screen.findByRole('table', { name: 'Knowledge Base articles' });
    expect(screen.queryByRole('button', { name: 'New Article' })).not.toBeInTheDocument();

    renderIndex(adminUser);
    expect(await screen.findByRole('button', { name: 'New Article' })).toBeInTheDocument();
  });

  it('disables the bulk actions for an Agent when rows are selected', async () => {
    renderIndex(agentUser);

    fireEvent.click(await screen.findByRole('checkbox', { name: /Select How to reset/ }));

    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Archive' })).toBeDisabled();
  });

  it('runs a bulk publish for an editor and reports what was skipped', async () => {
    mocked.bulkArticleAction.mockResolvedValue({
      action: 'publish',
      affected: 0,
      skipped: [{ id: 1, title: 'How to reset your password' }],
    });

    renderIndex(adminUser);

    fireEvent.click(await screen.findByRole('checkbox', { name: /Select How to reset/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    // The bulk bar's trigger and the confirm dialog's button share the label
    // "Publish", so the confirm must be scoped to the dialog — an unscoped
    // query would silently re-click the trigger and never confirm.
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Publish' }));

    await waitFor(() => {
      expect(mocked.bulkArticleAction).toHaveBeenCalledWith({ action: 'publish', ids: [1] });
    });

    // A silent count mismatch would be worse than no feedback.
    expect(await screen.findByRole('status')).toHaveTextContent('1 skipped');
  });
});
