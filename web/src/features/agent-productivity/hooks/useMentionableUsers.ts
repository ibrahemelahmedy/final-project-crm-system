import { useQuery } from '@tanstack/react-query';
import { fetchMentionableUsers } from '../api/mentionsApi';
import { productivityKeys } from '../api/queryKeys';

export function useMentionableUsers(ticketId: number, enabled: boolean) {
  return useQuery({
    queryKey: productivityKeys.mentionableUsers(ticketId),
    queryFn: () => fetchMentionableUsers(ticketId),
    enabled,
  });
}
