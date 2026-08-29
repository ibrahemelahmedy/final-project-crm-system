import { useQuery } from '@tanstack/react-query';
import { fetchQuickReplies, type QuickReplyListParams } from '../api/quickRepliesApi';
import { productivityKeys } from '../api/queryKeys';

export function useQuickReplies(params: QuickReplyListParams) {
  return useQuery({
    queryKey: productivityKeys.quickReplies.list(params),
    queryFn: () => fetchQuickReplies(params),
    placeholderData: (prev) => prev,
  });
}
