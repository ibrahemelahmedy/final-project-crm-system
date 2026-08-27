import { useQuery } from '@tanstack/react-query';
import { fetchTicketMeta } from '../api/ticketsApi';
import { ticketKeys } from '../api/queryKeys';

/**
 * The facet options behind every filter dropdown and the agent picker.
 * Deliberately NOT GET /api/users — Story 08 owns that endpoint and its richer
 * shape; this returns id and name only.
 */
export function useTicketMeta() {
  return useQuery({
    queryKey: ticketKeys.meta(),
    queryFn: fetchTicketMeta,
    // Options change rarely; the facet request must not re-fire per keystroke.
    staleTime: 5 * 60 * 1000,
  });
}
