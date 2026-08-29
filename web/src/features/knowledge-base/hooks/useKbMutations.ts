import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  archiveArticle,
  bulkArticleAction,
  createArticle,
  publishArticle,
  unpublishArticle,
  updateArticle,
  type KbBulkPayload,
} from '../api/kbApi';
import { kbKeys } from '../api/queryKeys';
import type { ArticleFormValues } from '../model/articleSchema';

// Every mutation invalidates kbKeys.all. The list, the category counts, the
// most-viewed rail, and the detail all shift when an article changes, and
// four separate invalidations is four chances to forget one.
function useInvalidateKb() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: kbKeys.all });
}

export function useCreateArticle() {
  const invalidate = useInvalidateKb();
  return useMutation({
    mutationFn: (values: ArticleFormValues) => createArticle(values),
    onSuccess: invalidate,
  });
}

export function useUpdateArticle(slug: string) {
  const invalidate = useInvalidateKb();
  return useMutation({
    mutationFn: (values: ArticleFormValues) => updateArticle(slug, values),
    onSuccess: invalidate,
  });
}

export function usePublishArticle() {
  const invalidate = useInvalidateKb();
  return useMutation({
    mutationFn: (slug: string) => publishArticle(slug),
    onSuccess: invalidate,
  });
}

export function useUnpublishArticle() {
  const invalidate = useInvalidateKb();
  return useMutation({
    mutationFn: (slug: string) => unpublishArticle(slug),
    onSuccess: invalidate,
  });
}

export function useArchiveArticle() {
  const invalidate = useInvalidateKb();
  return useMutation({
    mutationFn: (slug: string) => archiveArticle(slug),
    onSuccess: invalidate,
  });
}

export function useBulkArticleAction() {
  const invalidate = useInvalidateKb();
  return useMutation({
    mutationFn: (payload: KbBulkPayload) => bulkArticleAction(payload),
    onSuccess: invalidate,
  });
}
