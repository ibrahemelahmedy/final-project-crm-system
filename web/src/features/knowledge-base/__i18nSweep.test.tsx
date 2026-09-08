import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '../../i18n/instance';
import { KnowledgeBaseIndexPage } from './pages/KnowledgeBaseIndexPage';
import { ArticleReaderPage } from './pages/ArticleReaderPage';
import { ArticleEditorPage } from './pages/ArticleEditorPage';
import * as kbApi from './api/kbApi';
import { KbHarness } from './testUtils';
import { agentUser, adminUser, categoriesFixture, makePage, makeSummary, makeArticle } from './testFixtures';

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual('../../lib/api');
  return { ...actual, api: { post: vi.fn() } };
});
vi.mock('./api/kbApi');

const mocked = kbApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

// Every UI-chrome string this story's plan enumerated for knowledge-base,
// verbatim from the pre-migration source. If any of these render while the
// active language is 'ar', that specific string was missed.
const CHROME_STRINGS_EN = [
  'Knowledge Base', 'New Article', 'Search articles, guides, and FAQs',
  'CATEGORIES', 'All Articles', 'MOST VIEWED', 'Published', 'Draft', 'Archived',
  'No articles yet', 'No articles match', 'Reset filters', 'Clear filters',
  'ARTICLE', 'CATEGORY', 'STATUS', 'VIEWS', 'UPDATED',
  'Last updated', 'min read', 'revision', 'ON THIS PAGE', 'Back to Knowledge Base',
  'Edit article', 'New article', 'Save draft', 'Publish', 'Unpublish', 'Cancel',
  'Title', 'Body (Markdown)', 'Select a category', 'PREVIEW',
];

beforeEach(() => {
  vi.clearAllMocks();
  mocked.listCategories.mockResolvedValue(categoriesFixture);
  mocked.listMostViewed.mockResolvedValue([]);
  mocked.listArticles.mockResolvedValue(makePage([]));
  mocked.getArticle.mockResolvedValue(makeArticle());
  mocked.listCategories.mockResolvedValue(categoriesFixture);
});

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('Knowledge Base — Arabic chrome sweep', () => {
  it('IndexPage (empty state, admin) renders no English chrome string under ar', async () => {
    await i18n.changeLanguage('ar');
    render(
      <MemoryRouter initialEntries={['/knowledge-base']}>
        <KbHarness user={adminUser}>
          <Routes>
            <Route path="/knowledge-base" element={<KnowledgeBaseIndexPage />} />
          </Routes>
        </KbHarness>
      </MemoryRouter>
    );
    await waitFor(() => expect((document.body.textContent ?? '').length).toBeGreaterThan(20)); // wait for first paint past loading
    const body = document.body.textContent ?? '';
    const hits = CHROME_STRINGS_EN.filter((s) => body.includes(s));
    expect(hits, `English chrome leaked under ar: ${hits.join(', ')}`).toEqual([]);
  });

  it('ArticleReaderPage renders no English chrome string under ar', async () => {
    await i18n.changeLanguage('ar');
    render(
      <MemoryRouter initialEntries={['/knowledge-base/how-to-reset-your-password']}>
        <KbHarness user={agentUser}>
          <Routes>
            <Route path="/knowledge-base/:slug" element={<ArticleReaderPage />} />
          </Routes>
        </KbHarness>
      </MemoryRouter>
    );
    await waitFor(() => expect((document.body.textContent ?? '').length).toBeGreaterThan(20));
    const body = document.body.textContent ?? '';
    const hits = CHROME_STRINGS_EN.filter((s) => body.includes(s));
    expect(hits, `English chrome leaked under ar: ${hits.join(', ')}`).toEqual([]);
  });

  it('ArticleEditorPage (new) renders no English chrome string under ar', async () => {
    await i18n.changeLanguage('ar');
    render(
      <MemoryRouter initialEntries={['/knowledge-base/new']}>
        <KbHarness user={adminUser}>
          <Routes>
            <Route path="/knowledge-base/new" element={<ArticleEditorPage />} />
          </Routes>
        </KbHarness>
      </MemoryRouter>
    );
    await waitFor(() => expect((document.body.textContent ?? '').length).toBeGreaterThan(20));
    const body = document.body.textContent ?? '';
    const hits = CHROME_STRINGS_EN.filter((s) => body.includes(s));
    expect(hits, `English chrome leaked under ar: ${hits.join(', ')}`).toEqual([]);
  });
});
