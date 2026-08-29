import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AxiosError } from 'axios';
import { ArticleEditorPage } from './ArticleEditorPage';
import { ArticleReaderPage } from './ArticleReaderPage';
import * as kbApi from '../api/kbApi';
import { KbHarness } from '../testUtils';
import { adminUser, categoriesFixture, makeArticle } from '../testFixtures';

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api');
  return { ...actual, api: { post: vi.fn() } };
});

vi.mock('../api/kbApi');

const mocked = kbApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

// The exact HTML the server returns for one Markdown source. Both the preview
// and the reader are handed this same string, which is the point of the test
// below: one pipeline, one output.
const SOURCE = 'Intro paragraph.\n\n## A section\n\nBody text.';
const SERVER_HTML =
  '<p>Intro paragraph.</p>\n<h2 id="a-section">A section</h2>\n<p>Body text.</p>';

function renderEditor(path = '/knowledge-base/new') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <KbHarness user={adminUser}>
        <Routes>
          <Route path="/knowledge-base/new" element={<ArticleEditorPage />} />
          <Route path="/knowledge-base/:slug/edit" element={<ArticleEditorPage />} />
          <Route path="/knowledge-base/:slug" element={<ArticleReaderPage />} />
        </Routes>
      </KbHarness>
    </MemoryRouter>
  );
}

describe('ArticleEditorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.listCategories.mockResolvedValue(categoriesFixture);
    mocked.previewMarkdown.mockResolvedValue({
      body_html: SERVER_HTML,
      toc: [{ id: 'a-section', text: 'A section', level: 2 }],
      direction: 'ltr',
      read_minutes: 1,
    });
    mocked.getArticle.mockResolvedValue(makeArticle());
    mocked.createArticle.mockResolvedValue(makeArticle({ slug: 'new-article' }));
    mocked.updateArticle.mockResolvedValue(makeArticle());
    mocked.publishArticle.mockResolvedValue(makeArticle());
  });

  it('blocks Publish without a category and names the missing field', async () => {
    renderEditor();

    fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'A title' } });
    fireEvent.change(screen.getByLabelText('Body (Markdown)'), { target: { value: 'A body.' } });
    // Category deliberately left unselected.
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    expect(
      await screen.findByText('A category is required before this article can be published.')
    ).toBeInTheDocument();

    // Nothing is saved and nothing is published — the author is told what is
    // missing before the article silently lands as a draft.
    expect(mocked.createArticle).not.toHaveBeenCalled();
    expect(mocked.publishArticle).not.toHaveBeenCalled();
  });

  it('blocks Publish without a body', async () => {
    renderEditor();

    fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'A title' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    expect(
      await screen.findByText('A body is required before this article can be published.')
    ).toBeInTheDocument();
    expect(mocked.publishArticle).not.toHaveBeenCalled();
  });

  it('blocks Publish without a title', async () => {
    renderEditor();

    fireEvent.change(await screen.findByLabelText('Body (Markdown)'), { target: { value: 'A body.' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    expect(await screen.findByText('A title is required.')).toBeInTheDocument();
  });

  it('saves a draft with only a title — a draft does not need a body or a category', async () => {
    renderEditor();

    fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'Just a title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => {
      expect(mocked.createArticle).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Just a title' })
      );
    });
    expect(mocked.publishArticle).not.toHaveBeenCalled();
  });

  it('saves and then publishes when every required field is present', async () => {
    renderEditor();

    fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'Complete' } });
    fireEvent.change(screen.getByLabelText('Body (Markdown)'), { target: { value: 'A body.' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    // Publish is TWO sequential round trips — save, then publish — and the
    // debounced preview query competes for the same microtask queue. The
    // default 1s waitFor window is not reliably enough under a full-suite run,
    // so both waits are given explicit headroom.
    await waitFor(() => expect(mocked.createArticle).toHaveBeenCalled(), { timeout: 3000 });
    await waitFor(() => expect(mocked.publishArticle).toHaveBeenCalledWith('new-article'), {
      timeout: 3000,
    });
  });

  it('renders the preview from the SERVER pipeline, matching the reader for the same source', async () => {
    renderEditor();

    fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'Preview me' } });
    fireEvent.change(screen.getByLabelText('Body (Markdown)'), { target: { value: SOURCE } });

    // The preview is server-rendered — never a second, browser-side Markdown
    // renderer, or a payload could look safe here and behave differently once
    // saved.
    await waitFor(() => expect(mocked.previewMarkdown).toHaveBeenCalledWith(SOURCE), {
      timeout: 2000,
    });

    const preview = await screen.findByTestId('kb-preview-body');
    await waitFor(() => expect(preview.innerHTML).toBe(SERVER_HTML));

    // And the reader, handed the same source's server output, renders exactly
    // the same HTML.
    mocked.getArticle.mockResolvedValue(makeArticle({ body: SOURCE, body_html: SERVER_HTML }));
    render(
      <MemoryRouter initialEntries={['/knowledge-base/how-to-reset-your-password']}>
        <KbHarness user={adminUser}>
          <Routes>
            <Route path="/knowledge-base/:slug" element={<ArticleReaderPage />} />
          </Routes>
        </KbHarness>
      </MemoryRouter>
    );

    const readerBody = await screen.findByTestId('kb-article-body');
    expect(readerBody.innerHTML).toBe(preview.innerHTML);
  });

  it('does not round-trip a preview for an empty body', async () => {
    renderEditor();

    await screen.findByLabelText('Title');
    expect(screen.getByText(/The preview appears here as you write/)).toBeInTheDocument();
    expect(mocked.previewMarkdown).not.toHaveBeenCalled();
  });

  it('hydrates the form from an existing article when editing', async () => {
    renderEditor('/knowledge-base/how-to-reset-your-password/edit');

    await waitFor(() => {
      expect(screen.getByLabelText('Title')).toHaveValue('How to reset your password');
    });
    expect(screen.getByLabelText('Body (Markdown)')).toHaveValue(makeArticle().body);
    expect(screen.getByLabelText('Category')).toHaveValue('1');
  });

  it("maps a server 422 onto the field it names", async () => {
    const error = new AxiosError('Unprocessable');
    // @ts-expect-error minimal fake response
    error.response = {
      status: 422,
      data: { errors: { kb_category_id: ['A category is required before publishing.'] } },
    };
    mocked.createArticle.mockRejectedValueOnce(error);

    renderEditor();

    fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'A title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    expect(await screen.findByText('A category is required before publishing.')).toBeInTheDocument();
  });

  it('offers Unpublish only for a published article', async () => {
    mocked.getArticle.mockResolvedValue(makeArticle({ status: 'draft', status_label: 'Draft' }));
    renderEditor('/knowledge-base/how-to-reset-your-password/edit');

    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('How to reset your password'));
    expect(screen.queryByRole('button', { name: 'Unpublish' })).not.toBeInTheDocument();
  });
});
