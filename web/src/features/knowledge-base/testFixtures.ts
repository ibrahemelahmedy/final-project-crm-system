import type { User } from '../auth/AuthContext';
import type { Article, ArticleSummary, CategoriesResponse, Paginated } from './model/article';

// Shared fixtures for the Knowledge Base tests. Split out of testUtils.tsx so
// that file exports a component and nothing else — the react-refresh lint rule
// flags a module that mixes the two.

export const agentUser: User = {
  id: 1,
  name: 'Sarah Ahmed',
  email: 'agent@wisal.test',
  role: 'agent',
  role_label: 'Agent',
  home_route: '/dashboard',
  is_active: true,
};

export const leadUser: User = {
  ...agentUser,
  id: 2,
  name: 'Mona Zaki',
  email: 'lead@wisal.test',
  role: 'team_lead',
  role_label: 'Team Lead',
};

export const adminUser: User = {
  ...agentUser,
  id: 3,
  name: 'System Admin',
  email: 'admin@wisal.test',
  role: 'administrator',
  role_label: 'Administrator',
  home_route: '/dashboard/admin',
};

export const makeSummary = (overrides: Partial<ArticleSummary> = {}): ArticleSummary => ({
  id: 1,
  title: 'How to reset your password',
  slug: 'how-to-reset-your-password',
  excerpt: 'Step-by-step instructions for requesting a reset link.',
  status: 'published',
  status_label: 'Published',
  category: { id: 1, name: 'Account & Access', slug: 'account-access' },
  author: { id: 3, name: 'System Admin' },
  view_count: 1420,
  published_at: '2026-08-20T09:00:00.000000Z',
  updated_at: '2026-08-20T09:00:00.000000Z',
  ...overrides,
});

export const makeArticle = (overrides: Partial<Article> = {}): Article => ({
  ...makeSummary(),
  body: 'Intro paragraph.\n\n## Requesting a reset link\n\nBody text.',
  body_html:
    '<p>Intro paragraph.</p>\n<h2 id="requesting-a-reset-link">Requesting a reset link</h2>\n<p>Body text.</p>',
  created_at: '2026-07-01T09:00:00.000000Z',
  version_count: 0,
  read_minutes: 4,
  direction: 'ltr',
  toc: [{ id: 'requesting-a-reset-link', text: 'Requesting a reset link', level: 2 }],
  ...overrides,
});

export function makePage<T>(data: T[], total = data.length): Paginated<T> {
  return { data, meta: { current_page: 1, last_page: 1, per_page: 25, total } };
}

export const categoriesFixture: CategoriesResponse = {
  data: [
    { id: 1, name: 'Account & Access', slug: 'account-access', article_count: 2 },
    { id: 2, name: 'Billing', slug: 'billing', article_count: 1 },
  ],
  total: 3,
  published_total: 3,
};
