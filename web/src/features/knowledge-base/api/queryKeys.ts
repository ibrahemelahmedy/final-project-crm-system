// One factory so every invalidation targets the same prefix. Mutations
// invalidate kbKeys.all — the list, the category counts, the most-viewed rail
// and the detail all shift when an article changes, and three separate
// invalidations is three chances to forget one.
export const kbKeys = {
  all: ['kb'] as const,
  list: (params: Record<string, unknown>) => ['kb', 'list', params] as const,
  categories: () => ['kb', 'categories'] as const,
  mostViewed: () => ['kb', 'most-viewed'] as const,
  article: (slug: string) => ['kb', 'article', slug] as const,
  search: (q: string, limit: number) => ['kb', 'search', q, limit] as const,
};
