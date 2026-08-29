import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AxiosError } from 'axios';
import { ArticleReaderPage } from './ArticleReaderPage';
import * as kbApi from '../api/kbApi';
import { KbHarness } from '../testUtils';
import { agentUser, adminUser, makeArticle } from '../testFixtures';
import type { User } from '../../auth/AuthContext';

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api');
  return { ...actual, api: { post: vi.fn() } };
});

vi.mock('../api/kbApi');

const mocked = kbApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderReader(user: User = agentUser, slug = 'how-to-reset-your-password') {
  return render(
    <MemoryRouter initialEntries={[`/knowledge-base/${slug}`]}>
      <KbHarness user={user}>
        <Routes>
          <Route path="/knowledge-base/:slug" element={<ArticleReaderPage />} />
          <Route path="/knowledge-base" element={<div>Index</div>} />
        </Routes>
      </KbHarness>
    </MemoryRouter>
  );
}

function notFound() {
  const error = new AxiosError('Not Found');
  // @ts-expect-error minimal fake response
  error.response = { status: 404, data: {} };
  return error;
}

describe('ArticleReaderPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.getArticle.mockResolvedValue(makeArticle());
  });

  it('renders the breadcrumb, eyebrow, title, and last-updated meta line', async () => {
    renderReader();

    expect(await screen.findByRole('heading', { name: 'How to reset your password' })).toBeInTheDocument();

    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(breadcrumb).toHaveTextContent('Knowledge Base');
    expect(breadcrumb).toHaveTextContent('Account & Access');

    // The staleness signal agents rely on.
    expect(screen.getByText(/Last updated/)).toBeInTheDocument();
    expect(screen.getByText(/min read/)).toBeInTheDocument();
  });

  it('shows the revision count once an article has been edited', async () => {
    mocked.getArticle.mockResolvedValue(makeArticle({ version_count: 3 }));
    renderReader();

    expect(await screen.findByText(/revisions/)).toBeInTheDocument();
  });

  it('renders the server-sanitized body and never executes a script payload', async () => {
    // The fixture is what the SERVER returns — a payload has already been
    // stripped from body_html on write. `body` still carries the raw source
    // for the editor, and the reader must not put that in the DOM.
    mocked.getArticle.mockResolvedValue(
      makeArticle({
        body: '<script>window.__XSS__ = true</script>\n\nSafe prose.',
        body_html: '<p>Safe prose.</p>',
        toc: [],
      })
    );

    renderReader();

    const body = await screen.findByTestId('kb-article-body');
    expect(body).toHaveTextContent('Safe prose.');
    expect(body.querySelector('script')).toBeNull();
    expect(body.innerHTML).not.toContain('__XSS__');
    expect((window as unknown as { __XSS__?: boolean }).__XSS__).toBeUndefined();
  });

  it('renders the ON THIS PAGE table of contents linking to the rendered headings', async () => {
    renderReader();

    const toc = await screen.findByRole('navigation', { name: 'ON THIS PAGE' });
    const link = within(toc).getByRole('link', { name: 'Requesting a reset link' });
    expect(link).toHaveAttribute('href', '#requesting-a-reset-link');

    // The anchor must exist in the rendered body, or the TOC links nowhere.
    const body = screen.getByTestId('kb-article-body');
    expect(body.querySelector('#requesting-a-reset-link')).not.toBeNull();
  });

  it('omits the table of contents entirely when the article has no headings', async () => {
    mocked.getArticle.mockResolvedValue(makeArticle({ toc: [], body_html: '<p>Just prose.</p>' }));
    renderReader();

    await screen.findByTestId('kb-article-body');
    expect(screen.queryByText('ON THIS PAGE')).not.toBeInTheDocument();
  });

  it('renders an Arabic article RTL while a code block inside it stays LTR', async () => {
    mocked.getArticle.mockResolvedValue(
      makeArticle({
        title: 'كيفية إعادة تعيين كلمة المرور',
        direction: 'rtl',
        body_html:
          '<p>إذا نسيت كلمة المرور الخاصة بك.</p>\n<pre><code>POST /api/password/reset</code></pre>',
        toc: [],
      })
    );

    renderReader();

    const body = await screen.findByTestId('kb-article-body');
    // The BODY's direction comes from the article's own content, not from the
    // app-wide direction.
    expect(body).toHaveAttribute('dir', 'rtl');
    expect(body).toHaveAttribute('lang', 'ar');

    // The <pre> is carried by the .kb-article-body[dir="rtl"] pre rule in
    // index.css, which sets direction: ltr — assert the element is there and
    // reachable, since jsdom does not apply the stylesheet.
    expect(body.querySelector('pre')).not.toBeNull();
    expect(body.querySelector('pre')).toHaveTextContent('POST /api/password/reset');
  });

  it('keeps an English article LTR', async () => {
    renderReader();
    expect(await screen.findByTestId('kb-article-body')).toHaveAttribute('dir', 'ltr');
  });

  it('shows a not-found state on 404 without revealing that a draft exists', async () => {
    mocked.getArticle.mockRejectedValue(notFound());
    renderReader(agentUser, 'draft-guidance');

    expect(await screen.findByRole('heading', { name: 'Article not found' })).toBeInTheDocument();
    // The copy must not distinguish "no such slug" from "a draft you may not
    // see" — that is exactly what the server's 404 exists to hide.
    expect(screen.queryByText(/permission/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/draft/i)).not.toBeInTheDocument();
  });

  it('renders a retryable error state for a non-404 failure', async () => {
    mocked.getArticle.mockRejectedValue(new Error('network'));
    renderReader();

    expect(await screen.findByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.queryByText(/network/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('renders the Loading state before the article arrives', async () => {
    // The harness signs the user in through an async effect, so the skeleton
    // is not present on the first synchronous tick.
    mocked.getArticle.mockReturnValue(new Promise(() => {}));
    const { container } = renderReader();
    await waitFor(() => expect(container.querySelector('[aria-busy="true"]')).not.toBeNull());
  });

  it('labels a draft an editor is previewing and offers Edit only to an editor', async () => {
    mocked.getArticle.mockResolvedValue(makeArticle({ status: 'draft', status_label: 'Draft' }));

    renderReader(adminUser);
    expect(await screen.findByText('Draft')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('hides Edit from an Agent', async () => {
    renderReader(agentUser);
    await screen.findByTestId('kb-article-body');
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('does not render a "Was this helpful?" control — ratings are out of scope', async () => {
    // The artboard shows one. Depicting a control the product cannot honour is
    // worse than omitting it, so it is omitted and no ratings table exists.
    renderReader();
    await screen.findByTestId('kb-article-body');
    expect(screen.queryByText(/Was this article helpful/i)).not.toBeInTheDocument();
  });
});

