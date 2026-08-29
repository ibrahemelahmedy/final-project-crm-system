import { useQuery } from '@tanstack/react-query';
import { fetchTicketCsat } from '../api/csatApi';

/** Story 13 — the agent-side ticket-detail panel's data source. */
export function useTicketCsat(ticketId: number, enabled = true) {
  return useQuery({
    queryKey: ['ticket-csat', ticketId],
    queryFn: () => fetchTicketCsat(ticketId),
    enabled: enabled && Number.isFinite(ticketId),
  });
}
