import { useQuery } from '@tanstack/react-query';
import { fetchTicketEvents } from '../api/ticketsApi';
import { ticketKeys } from '../api/queryKeys';

export function useTicketEvents(id: number) {
  return useQuery({
    queryKey: ticketKeys.events(id),
    queryFn: () => fetchTicketEvents(id),
  });
}
