import type { TicketFilters } from '../model/ticketFilters';

/**
 * One keying scheme for every ticket query.
 *
 * Stories 05, 06, 07, 11, 12 and 13 nest under `ticketKeys.all`, and EVERY
 * ticket mutation invalidates that root. A narrower invalidation is what
 * leaves a stale queue behind after a status change made elsewhere.
 */
export const ticketKeys = {
  all: ['tickets'] as const,
  list: (filters: TicketFilters) => [...ticketKeys.all, 'list', filters] as const,
  detail: (id: number) => [...ticketKeys.all, 'detail', id] as const,
  events: (id: number) => [...ticketKeys.all, 'events', id] as const,
  messages: (id: number) => [...ticketKeys.all, 'messages', id] as const,
  meta: () => [...ticketKeys.all, 'meta'] as const,
};
