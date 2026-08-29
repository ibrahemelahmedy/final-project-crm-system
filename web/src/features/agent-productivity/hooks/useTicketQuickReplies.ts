import { useQuery } from '@tanstack/react-query';
import { fetchTicketQuickReplies } from '../api/quickRepliesApi';
import { productivityKeys } from '../api/queryKeys';

/** The picker's data source. Enabled only while the picker is open — `enabled` is caller-controlled. */
export function useTicketQuickReplies(ticketId: number, enabled: boolean) {
  return useQuery({
    queryKey: productivityKeys.quickReplies.forTicket(ticketId),
    queryFn: () => fetchTicketQuickReplies(ticketId),
    enabled,
  });
}
