/**
 * Story 17 (WIS-16) — the one TanStack Query keying scheme for anything
 * portal-shaped, matching the project's `ticketKeys` precedent. Every portal
 * mutation invalidates `portalKeys.all`. Deliberately separate from
 * `ticketKeys` — a portal mutation must never invalidate a staff cache.
 */
export const portalKeys = {
  all: ['portal'] as const,
  session: () => [...portalKeys.all, 'session'] as const,
  requests: (scope: 'open' | 'past') => [...portalKeys.all, 'requests', scope] as const,
  request: (id: number | string) => [...portalKeys.all, 'request', id] as const,
  faq: (params: Record<string, unknown> = {}) => [...portalKeys.all, 'faq', params] as const,
  article: (slug: string) => [...portalKeys.all, 'article', slug] as const,
};
