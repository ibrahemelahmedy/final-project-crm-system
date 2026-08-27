// One factory so every invalidation targets the same prefix. Mutations
// invalidate customerKeys.all — the list, the facets, and the detail all
// shift when a customer changes.
export const customerKeys = {
  all: ['customers'] as const,
  list: (params: Record<string, unknown>) => ['customers', 'list', params] as const,
  facets: (params: Record<string, unknown>) => ['customers', 'facets', params] as const,
  detail: (id: number) => ['customers', 'detail', id] as const,
  tickets: (id: number, page: number) => ['customers', 'tickets', id, page] as const,
  notes: (id: number) => ['customers', 'notes', id] as const,
  attachments: (id: number) => ['customers', 'attachments', id] as const,
};
