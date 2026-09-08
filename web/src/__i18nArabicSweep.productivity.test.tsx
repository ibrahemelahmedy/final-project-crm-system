import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import i18n from './i18n/instance';
import { QuickRepliesPage } from './features/agent-productivity/pages/QuickRepliesPage';
import { ProductivityHarness } from './features/agent-productivity/testUtils';
import { makeQuickReply } from './features/agent-productivity/testFixtures';
import * as quickRepliesApi from './features/agent-productivity/api/quickRepliesApi';

vi.mock('./lib/api', async () => {
  const actual = await vi.importActual('./lib/api');
  return { ...actual, api: { post: vi.fn(), get: vi.fn(), patch: vi.fn() } };
});
vi.mock('./features/agent-productivity/api/quickRepliesApi');

const mocked = quickRepliesApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

const CHROME_STRINGS_EN = [
  'Quick Replies', 'templates in the shared library', 'New quick reply', 'Category:',
  'Status:', 'All', 'Active', 'Archived', "Couldn't load quick replies", 'Retry',
  'No quick replies yet', 'Create your first quick reply', 'TITLE', 'PREVIEW', 'CATEGORY',
  'STATUS', 'LAST UPDATED', 'ACTIONS', 'Edit', 'Archive', 'Showing', 'of',
];

function paginated(items: ReturnType<typeof makeQuickReply>[]) {
  return {
    data: items,
    meta: { current_page: 1, last_page: 1, per_page: 10, from: items.length ? 1 : null, to: items.length || null, total: items.length },
    links: { first: null, last: null, prev: null, next: null },
  };
}

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('Quick Replies — Arabic chrome sweep', () => {
  it('renders no English chrome string under ar (populated table)', async () => {
    await i18n.changeLanguage('ar');
    mocked.fetchQuickReplies.mockResolvedValue(paginated([makeQuickReply()]));
    render(
      <MemoryRouter initialEntries={['/quick-replies']}>
        <ProductivityHarness>
          <QuickRepliesPage />
        </ProductivityHarness>
      </MemoryRouter>
    );
    await waitFor(() => expect((document.body.textContent ?? '').length).toBeGreaterThan(20));
    const body = document.body.textContent ?? '';
    const hits = CHROME_STRINGS_EN.filter((s) => body.includes(s));
    expect(hits, `English chrome leaked under ar: ${hits.join(', ')}`).toEqual([]);
  });

  it('renders no English chrome string under ar (empty state)', async () => {
    await i18n.changeLanguage('ar');
    mocked.fetchQuickReplies.mockResolvedValue(paginated([]));
    render(
      <MemoryRouter initialEntries={['/quick-replies']}>
        <ProductivityHarness>
          <QuickRepliesPage />
        </ProductivityHarness>
      </MemoryRouter>
    );
    await waitFor(() => expect((document.body.textContent ?? '').length).toBeGreaterThan(20));
    const body = document.body.textContent ?? '';
    const hits = CHROME_STRINGS_EN.filter((s) => body.includes(s));
    expect(hits, `English chrome leaked under ar: ${hits.join(', ')}`).toEqual([]);
  });
});
