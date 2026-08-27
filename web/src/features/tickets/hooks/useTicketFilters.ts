import { useCallback, useMemo } from 'react';
import { useSearchParams, type URLSearchParamsInit } from 'react-router-dom';
import {
  DEFAULT_FILTERS,
  FACET_KEYS,
  countActiveFacets,
  parseTicketFilters,
  type TicketFilters,
} from '../model/ticketFilters';

type SetFiltersOptions = {
  /** Skip the page reset. Only the pagination controls pass this. */
  keepPage?: boolean;
  /** `true` for the debounced search box, `false` for a deliberate facet change. */
  replace?: boolean;
};

function readFromSearchParams(searchParams: URLSearchParams): TicketFilters {
  return parseTicketFilters({
    status: searchParams.getAll('status'),
    priority: searchParams.getAll('priority'),
    channel: searchParams.getAll('channel'),
    category: searchParams.getAll('category'),
    assigned_to: searchParams.getAll('assigned_to'),
    q: searchParams.get('q') ?? undefined,
    sort: searchParams.get('sort') ?? undefined,
    page: searchParams.get('page') ?? undefined,
    per_page: searchParams.get('per_page') ?? undefined,
  });
}

/** Defaults are never written to the URL — /tickets stays clean until filtered. */
function writeToSearchParams(filters: TicketFilters): URLSearchParams {
  const next = new URLSearchParams();

  for (const key of FACET_KEYS) {
    for (const value of filters[key]) next.append(key, value);
  }

  const q = filters.q.trim();
  if (q) next.set('q', q);
  if (filters.sort !== DEFAULT_FILTERS.sort) next.set('sort', filters.sort);
  if (filters.page !== DEFAULT_FILTERS.page) next.set('page', String(filters.page));
  if (filters.per_page !== DEFAULT_FILTERS.per_page) next.set('per_page', String(filters.per_page));

  return next;
}

/**
 * `searchParams` is the ONLY source of truth for filter state. There is no
 * useState mirror — a mirrored copy is how the back button starts disagreeing
 * with the table.
 */
export function useTicketFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => readFromSearchParams(searchParams), [searchParams]);

  const setFilters = useCallback(
    (patch: Partial<TicketFilters>, options: SetFiltersOptions = {}) => {
      const { keepPage = false, replace = false } = options;

      // Merge against the params as they are when the update applies, via
      // react-router's functional form — never against a render-time snapshot.
      setSearchParams(
        (prev) => {
          const merged: TicketFilters = { ...readFromSearchParams(prev), ...patch };
          // Any facet change resets the page. Landing on page 7 of a two-page
          // result is the classic faceted-search bug.
          if (!keepPage && !('page' in patch)) merged.page = 1;
          return writeToSearchParams(merged) as unknown as URLSearchParamsInit;
        },
        { replace }
      );
    },
    [setSearchParams]
  );

  /** Clears every facet and the search term, but keeps per_page. */
  const clearFilters = useCallback(() => {
    setSearchParams(
      (prev) => {
        const current = readFromSearchParams(prev);
        return writeToSearchParams({
          ...DEFAULT_FILTERS,
          per_page: current.per_page,
        }) as unknown as URLSearchParamsInit;
      },
      { replace: false }
    );
  }, [setSearchParams]);

  const activeCount = useMemo(() => countActiveFacets(filters), [filters]);

  return { filters, setFilters, clearFilters, activeCount };
}
