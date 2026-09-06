/**
 * Rooted at ['integrations'], deliberately NOT nested under ticketKeys.all —
 * see web/src/features/sla-rules/api/queryKeys.ts for the same reasoning.
 * Nothing in this feature changes a ticket, so ticketKeys.all is never
 * invalidated from here.
 */
export const integrationKeys = {
  all: ['integrations'] as const,
  list: () => [...integrationKeys.all, 'list'] as const,
};
