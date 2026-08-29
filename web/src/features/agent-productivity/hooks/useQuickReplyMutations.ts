import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  archiveQuickReply,
  createQuickReply,
  updateQuickReply,
} from '../api/quickRepliesApi';
import { productivityKeys } from '../api/queryKeys';
import type { QuickReplyFormValues } from '../model/quickReplySchema';

export function useCreateQuickReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: QuickReplyFormValues) => createQuickReply(values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productivityKeys.quickReplies.all }),
  });
}

export function useUpdateQuickReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: number; values: Partial<QuickReplyFormValues> }) =>
      updateQuickReply(id, values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productivityKeys.quickReplies.all }),
  });
}

export function useArchiveQuickReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => archiveQuickReply(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productivityKeys.quickReplies.all }),
  });
}
