import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateTicket } from '../api/ticketsApi';
import { ticketKeys } from '../api/queryKeys';
import type { TicketStatus } from '../model/ticket';

type AttributePatch = Partial<{
  status: TicketStatus;
  priority: string;
  assigned_to: number | null;
}>;

/**
 * PATCH one attribute (status | priority | assigned_to) through Story 04's
 * `PATCH /api/tickets/{ticket}`. On success invalidate `ticketKeys.all` so the
 * panel and the Activity list update without a reload (intake AC 7).
 *
 * Also invalidates the `['tasks', ...]` key prefix: Story 10's close-hook
 * cancels this ticket's open tasks server-side on a close transition, and
 * without this the Tasks panel (a separate query namespace) would keep
 * showing them as open until an unrelated refetch happened to run.
 */
export function useTicketAttributeMutation(ticketId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: AttributePatch) => updateTicket(ticketId, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.all });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
