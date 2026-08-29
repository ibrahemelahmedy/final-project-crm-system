import { useQuery } from '@tanstack/react-query';
import { fetchTicket } from '../api/ticketsApi';
import { ticketKeys } from '../api/queryKeys';

/**
 * `retry: false` here — the default `retry: 1` would request a 403 twice
 * before the Forbidden state appears, doubling latency on the one path where
 * the user is already blocked. queryClient.ts itself stays untouched.
 */
export function useTicketDetail(id: number) {
  return useQuery({
    queryKey: ticketKeys.detail(id),
    queryFn: () => fetchTicket(id),
    retry: false,
  });
}
