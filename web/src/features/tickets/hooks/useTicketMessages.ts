import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchMessages } from '../api/messagesApi';
import { ticketKeys } from '../api/queryKeys';
import type { TicketMessage } from '../model/ticketMessage';

/**
 * The API's cursor moves from newest towards oldest, so TanStack's
 * `hasNextPage` here means "there are OLDER messages" and `getNextPageParam`
 * walks BACKWARDS in time. Do not "fix" this into `getPreviousPageParam` —
 * that breaks the prepend.
 */
export function useTicketMessages(ticketId: number) {
  return useInfiniteQuery({
    queryKey: ticketKeys.messages(ticketId),
    queryFn: ({ pageParam }) => fetchMessages(ticketId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.meta.next_cursor, // "next" page = OLDER messages
  });
}

/**
 * Flatten infinite-query pages into one oldest -> newest list:
 * reverse each page (page is newest-first), then concatenate pages in reverse
 * page order (page 0 is the newest slice, so it goes last).
 */
export function flattenChronological(
  pages: { data: TicketMessage[] }[] | undefined
): TicketMessage[] {
  if (!pages) return [];
  const out: TicketMessage[] = [];
  for (let i = pages.length - 1; i >= 0; i--) {
    const page = pages[i].data;
    for (let j = page.length - 1; j >= 0; j--) {
      out.push(page[j]);
    }
  }
  return out;
}
