import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bulkTickets, createTicket, updateTicket, type BulkPayload } from '../api/ticketsApi';
import { ticketKeys } from '../api/queryKeys';
import type { NewTicketValues } from '../model/newTicketSchema';

/**
 * Every mutation invalidates `ticketKeys.all` — the list, any detail, and the
 * events all shift when a ticket changes, and three separate invalidations is
 * three chances to forget one.
 */
export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: NewTicketValues) => createTicket(values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketKeys.all }),
  });
}

export function useUpdateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Parameters<typeof updateTicket>[1] }) =>
      updateTicket(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketKeys.all }),
  });
}

export function useBulkTickets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BulkPayload) => bulkTickets(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketKeys.all }),
  });
}
