import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from '../auth/RequireAuth';
import type { User } from '../auth/AuthContext';
import { KnowledgeBaseIndexPage, ArticleReaderPage, ArticleEditorPage } from './index';
import * as kbApi from './api/kbApi';
import { KbHarness } from './testUtils';
import {
agentUser,
  leadUser,
  adminUser,
  categoriesFixture,
  makeArticle,
  makePage,
  makeSummary,
} from './testFixtures';

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual('../../lib/api');
  return { ...actual, api: { post: vi.fn() } };
});

vi.mock('./api/kbApi');

const mocked = kbApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

/**
 * Mirrors the KB subtree of App.tsx, following the precedent set by
 * app/navigation/navRoutes.test.tsx. The route ORDER matters: /new and
 * /:slug/edit are declared before /:slug, or the dynamic segment swallows
 * "new" and the editor is never reachable.
 */
function renderAt(path: string, user: User) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <KbHarness user={user}>
        <Routes>
          <Route path="/knowledge-base" element={<KnowledgeBaseIndexPage />} />
          <Route
            path="/knowledge-base/new"
            element={
              <RequireAuth roles={['team_lead', 'administrator']}>
                <ArticleEditorPage />
              </RequireAuth>
            }
          />
          <Route
            path="/knowledge-base/:slug/edit"
            element={
              <RequireAuth roles={['team_lead', 'administrator']}>
                <ArticleEditorPage />
              </RequireAuth>
            }
          />
          <Route path="/knowledge-base/:slug" element={<ArticleReaderPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<div>Catch-all redirect</div>} />
        </Routes>
      </KbHarness>
    </MemoryRouter>
  );
}

describe('Knowledge Base routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.listCategories.mockResolvedValue(categoriesFixture);
    mocked.listMostViewed.mockResolvedValue([makeSummary()]);
    mocked.listArticles.mockResolvedValue(makePage([makeSummary()]));
    mocked.getArticle.mockResolvedValue(makeArticle());
    mocked.previewMarkdown.mockResolvedValue({
      body_html: '',
      toc: [],
      direction: 'ltr',
      read_minutes: 1,
    });
  });

  it.each([
    ['agent', agentUser],
    ['team_lead', leadUser],
    ['administrator', adminUser],
  ])('/knowledge-base resolves to the index for a %s', async (_role, user) => {
    renderAt('/knowledge-base', user as User);

    expect(await screen.findByRole('heading', { name: 'Knowledge Base', level: 1 })).toBeInTheDocument();
    // Not the catch-all redirect, and no PagePlaceholder left behind.
    expect(screen.queryByText('Catch-all redirect')).not.toBeInTheDocument();
    expect(screen.queryByTestId('page-placeholder')).not.toBeInTheDocument();
  });

  it.each([
    ['agent', agentUser],
    ['team_lead', leadUser],
    ['administrator', adminUser],
  ])('/knowledge-base/:slug resolves to the reader for a %s', async (_role, user) => {
    renderAt('/knowledge-base/how-to-reset-your-password', user as User);

    expect(
      await screen.findByRole('heading', { name: 'How to reset your password' })
    ).toBeInTheDocument();
  });

  it('refuses /knowledge-base/new for an Agent', async () => {
    renderAt('/knowledge-base/new', agentUser);

    expect(await screen.findByText('403 — Access Denied')).toBeInTheDocument();
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
  });

  it('refuses /knowledge-base/:slug/edit for an Agent', async () => {
    renderAt('/knowledge-base/how-to-reset-your-password/edit', agentUser);

    expect(await screen.findByText('403 — Access Denied')).toBeInTheDocument();
  });

  it.each([
    ['team_lead', leadUser],
    ['administrator', adminUser],
  ])('/knowledge-base/new resolves to the editor for a %s', async (_role, user) => {
    renderAt('/knowledge-base/new', user as User);

    expect(await screen.findByRole('heading', { name: 'New article' })).toBeInTheDocument();
    // "new" must NOT have been swallowed by the /:slug reader route.
    expect(mocked.getArticle).not.toHaveBeenCalled();
  });

  it('/knowledge-base/:slug/edit resolves to the editor for an editor', async () => {
    renderAt('/knowledge-base/how-to-reset-your-password/edit', adminUser);

    expect(await screen.findByRole('heading', { name: 'Edit article' })).toBeInTheDocument();
  });
});
