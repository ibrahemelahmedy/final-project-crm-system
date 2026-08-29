// One factory so every invalidation targets the same prefix. A user mutation
// invalidates adminKeys.all — the list, the facets, and the audit log all
// shift when a user changes, and three separate invalidations is three
// chances to forget one.
export const adminKeys = {
  all: ['admin'] as const,
  users: (params: Record<string, unknown>) => ['admin', 'users', params] as const,
  userFacets: () => ['admin', 'users', 'facets'] as const,
  user: (id: number) => ['admin', 'users', 'detail', id] as const,
  auditLogs: (params: Record<string, unknown>) => ['admin', 'audit-logs', params] as const,
  auditLogFacets: () => ['admin', 'audit-logs', 'facets'] as const,
  settings: () => ['admin', 'settings'] as const,
};
