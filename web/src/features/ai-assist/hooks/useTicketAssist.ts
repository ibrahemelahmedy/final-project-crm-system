import { useQuery } from '@tanstack/react-query';
import { fetchTicketAssist } from '../api/assistApi';
import { assistKeys } from '../api/queryKeys';

export function useTicketAssist(ticketId: number) {
  return useQuery({
    queryKey: assistKeys.detail(ticketId),
    queryFn: () => fetchTicketAssist(ticketId),
    enabled: Number.isFinite(ticketId),
  });
}
