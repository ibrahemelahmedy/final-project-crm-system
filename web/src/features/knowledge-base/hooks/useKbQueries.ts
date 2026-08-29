import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  getArticle,
  listArticles,
  listCategories,
  listMostViewed,
  searchArticles,
} from '../api/kbApi';
import { kbKeys } from '../api/queryKeys';
import type { KbListParams } from './useKbListParams';

// keepPreviousData (TanStack Query v5 — the v4 boolean flag is gone) is what
// stops the article list flashing its skeleton on every page change. Pair with
// isPlaceholderData to dim the table while a page change is in flight.
export function useKbArticles(params: KbListParams) {
  return useQuery({
    queryKey: kbKeys.list(params),
    queryFn: () => listArticles(params),
    placeholderData: keepPreviousData,
  });
}

export function useKbCategories() {
  return useQuery({
    queryKey: kbKeys.categories(),
    queryFn: listCategories,
  });
}

export function useMostViewed() {
  return useQuery({
    queryKey: kbKeys.mostViewed(),
    queryFn: listMostViewed,
  });
}

export function useKbArticle(slug: string | undefined) {
  return useQuery({
    queryKey: kbKeys.article(slug ?? ''),
    queryFn: () => getArticle(slug as string),
    enabled: Boolean(slug),
    // A 404 here means "draft, or no such slug" and is a final answer — the
    // reader must show its not-found state rather than retry three times
    // before admitting it.
    retry: false,
  });
}

/**
 * The picker's search. `enabled` on a non-empty term, so mounting the panel
 * does not fire a query before the agent has typed anything.
 */
export function useKbSearch(term: string, limit = 8) {
  const trimmed = term.trim();

  return useQuery({
    queryKey: kbKeys.search(trimmed, limit),
    queryFn: () => searchArticles(trimmed, limit),
    enabled: trimmed.length > 0,
    placeholderData: keepPreviousData,
  });
}
