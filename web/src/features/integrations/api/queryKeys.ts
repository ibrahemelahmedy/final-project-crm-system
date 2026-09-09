/**
 * Rooted at ['integrations'], deliberately NOT nested under ticketKeys.all —
 * see web/src/features/sla-rules/api/queryKeys.ts for the same reasoning.
 * Nothing in this feature changes a ticket, so ticketKeys.all is never
 * invalidated from here.
 */
import type { IntegrationTypeValue } from '../model/types';

export const integrationKeys = {
  all: ['integrations'] as const,
  list: () => [...integrationKeys.all, 'list'] as const,
  // Story 25 (WIS-24). Still rooted at ['integrations']; still never
  // invalidates ticketKeys.all — the docblock's rule holds.
  syncRuns: (type: IntegrationTypeValue, page: number) => [...integrationKeys.all, 'sync-runs', type, page] as const,
  deadLetters: (type: IntegrationTypeValue, page: number) => [...integrationKeys.all, 'outbox', type, page] as const,
};
