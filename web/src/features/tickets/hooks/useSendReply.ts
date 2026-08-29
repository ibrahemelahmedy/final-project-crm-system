import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sendMessage, type SendMessageOptions } from '../api/messagesApi';
import { ticketKeys } from '../api/queryKeys';
import type { CursorPaginated, TicketMessage } from '../model/ticketMessage';

/**
 * POST a reply. On success the created message (from the 201 body) is spliced
 * into the newest infinite-query page immediately, then `ticketKeys.all` is
 * invalidated so the queue row, the SLA card and the Activity list refresh.
 *
 * No optimistic append — a bubble that appears then vanishes on a failed send
 * is worse than a spinner. `mutations.retry` stays false (queryClient.ts).
 */
export function useSendReply(ticketId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ body, options }: { body: string; options?: SendMessageOptions }) =>
      sendMessage(ticketId, body, options),
    onSuccess: (message) => {
      queryClient.setQueryData<{
        pages: CursorPaginated<TicketMessage>[];
        pageParams: unknown[];
      }>(ticketKeys.messages(ticketId), (prev) => {
        if (!prev || prev.pages.length === 0) return prev;
        const [first, ...rest] = prev.pages;
        return {
          ...prev,
          pages: [{ ...first, data: [message, ...first.data] }, ...rest],
        };
      });
      queryClient.invalidateQueries({ queryKey: ticketKeys.all });
    },
  });
}
