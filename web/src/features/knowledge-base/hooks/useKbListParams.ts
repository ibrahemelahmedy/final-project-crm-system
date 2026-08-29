import { useCallback, useMemo } from 'react';
import { useSearchParams, type URLSearchParamsInit } from 'react-router-dom';
import type { ArticleStatus } from '../model/article';

/**
 * Filter, category, sort, and search state for the KB index, held in URL
 * search params — the same contract as Story 03's useCustomerListParams, so
 * the Back button and a shared link behave identically on both screens.
 */
export type KbListParams = {
  q: string;
  category: string[]; // category SLUGS, so a shared link survives a rename
  status: ArticleStatus[];
  sort: string; // default 'updated_at'
  dir: 'asc' | 'desc'; // default 'desc'
  page: number; // default 1
  per_page: number; // default 25
};

const DEFAULTS: KbListParams = {
  q: '',
  category: [],
  status: [],
  sort: 'updated_at',
  dir: 'desc',
  page: 1,
  per_page: 25,
};

// Mirrors IndexKbArticleRequest's server-side whitelist. Both are needed: the
// server's is the security control, this one keeps a hand-edited URL from
// producing a request the server will 422.
const SORT_WHITELIST = ['title', 'updated_at', 'published_at', 'view_count', 'status'];
const STATUS_WHITELIST: ArticleStatus[] = ['draft', 'published', 'archived'];

type SetParamsOptions = { resetPage?: boolean; replace?: boolean };

function parseParams(searchParams: URLSearchParams): KbListParams {
  const rawSort = searchParams.get('sort');
  const sort = rawSort && SORT_WHITELIST.includes(rawSort) ? rawSort : DEFAULTS.sort;
  const rawDir = searchParams.get('dir');
  const dir = rawDir === 'asc' ? 'asc' : DEFAULTS.dir;
  const rawPage = Number(searchParams.get('page'));
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : DEFAULTS.page;
  const rawPerPage = Number(searchParams.get('per_page'));
  const per_page =
    Number.isInteger(rawPerPage) && rawPerPage >= 5 && rawPerPage <= 100 ? rawPerPage : DEFAULTS.per_page;

  return {
    q: searchParams.get('q') ?? DEFAULTS.q,
    category: searchParams.getAll('category[]'),
    status: searchParams
      .getAll('status[]')
      .filter((s): s is ArticleStatus => STATUS_WHITELIST.includes(s as ArticleStatus)),
    sort,
    dir,
    page,
    per_page,
  };
}

function serializeParams(merged: KbListParams): URLSearchParams {
  const next = new URLSearchParams();
  // Defaults are never written to the URL — /knowledge-base must stay clean
  // until the user actually filters.
  if (merged.q) next.set('q', merged.q);
  merged.category.forEach((c) => next.append('category[]', c));
  merged.status.forEach((s) => next.append('status[]', s));
  if (merged.sort !== DEFAULTS.sort) next.set('sort', merged.sort);
  if (merged.dir !== DEFAULTS.dir) next.set('dir', merged.dir);
  if (merged.page !== DEFAULTS.page) next.set('page', String(merged.page));
  if (merged.per_page !== DEFAULTS.per_page) next.set('per_page', String(merged.per_page));
  return next;
}

// The ONE place useSearchParams is read for the KB list. No useState mirror of
// any of these fields exists anywhere else — a duplicate copy is how Back
// button behaviour and shareable links break.
export function useKbListParams(): [
  KbListParams,
  (patch: Partial<KbListParams>, options?: SetParamsOptions) => void,
  boolean,
] {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo(() => parseParams(searchParams), [searchParams]);

  const setParams = useCallback(
    (patch: Partial<KbListParams>, options: SetParamsOptions = {}) => {
      const { resetPage = true, replace = false } = options;

      // Merge against the search params at the time the update is applied
      // (react-router's functional setSearchParams form), not a snapshot
      // captured at render time.
      setSearchParams(
        (prevSearchParams) => {
          const merged: KbListParams = { ...parseParams(prevSearchParams), ...patch };
          if (resetPage && !('page' in patch)) {
            merged.page = 1;
          }
          return serializeParams(merged) as unknown as URLSearchParamsInit;
        },
        { replace }
      );
    },
    [setSearchParams]
  );

  const isFiltered = params.q !== '' || params.category.length > 0 || params.status.length > 0;

  return [params, setParams, isFiltered];
}
