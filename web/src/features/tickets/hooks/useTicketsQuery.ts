import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchTickets } from '../api/ticketsApi';
import { ticketKeys } from '../api/queryKeys';
import type { TicketFilters } from '../model/ticketFilters';

/**
 * `placeholderData: keepPreviousData` is required, not optional. Without it
 * every page change and filter toggle unmounts the table and shows the
 * skeleton — the "flash of skeleton" that makes server-side pagination feel
 * broken. With it the table dims via `isPlaceholderData` and the rows stay put,
 * so the skeleton only ever appears on a genuine first load.
 */
export function useTicketsQuery(filters: TicketFilters) {
  return useQuery({
    queryKey: ticketKeys.list(filters),
    queryFn: () => fetchTickets(filters),
    placeholderData: keepPreviousData,
  });
}
