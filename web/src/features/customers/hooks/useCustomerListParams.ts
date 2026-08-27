import { useCallback, useMemo } from 'react';
import { useSearchParams, type URLSearchParamsInit } from 'react-router-dom';
import type { CustomerTier } from '../model/customer';

export type CustomerListParams = {
  q: string;
  company: string[];
  tier: CustomerTier[];
  sort: string; // default 'name'
  dir: 'asc' | 'desc'; // default 'asc'
  page: number; // default 1
  per_page: number; // default 25
};

const DEFAULTS: CustomerListParams = {
  q: '',
  company: [],
  tier: [],
  sort: 'name',
  dir: 'asc',
  page: 1,
  per_page: 25,
};

const SORT_WHITELIST = ['name', 'company', 'open_tickets_count', 'last_contact_at', 'created_at'];
const TIER_WHITELIST: CustomerTier[] = ['standard', 'premium', 'enterprise'];

type SetParamsOptions = { resetPage?: boolean; replace?: boolean };

function parseParams(searchParams: URLSearchParams): CustomerListParams {
  const rawSort = searchParams.get('sort');
  const sort = rawSort && SORT_WHITELIST.includes(rawSort) ? rawSort : DEFAULTS.sort;
  const rawDir = searchParams.get('dir');
  const dir = rawDir === 'desc' ? 'desc' : DEFAULTS.dir;
  const rawPage = Number(searchParams.get('page'));
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : DEFAULTS.page;
  const rawPerPage = Number(searchParams.get('per_page'));
  const per_page =
    Number.isInteger(rawPerPage) && rawPerPage >= 5 && rawPerPage <= 100 ? rawPerPage : DEFAULTS.per_page;

  return {
    q: searchParams.get('q') ?? DEFAULTS.q,
    company: searchParams.getAll('company[]'),
    tier: searchParams.getAll('tier[]').filter((t): t is CustomerTier => TIER_WHITELIST.includes(t as CustomerTier)),
    sort,
    dir,
    page,
    per_page,
  };
}

function serializeParams(merged: CustomerListParams): URLSearchParams {
  const next = new URLSearchParams();
  // Defaults are never written to the URL — /customers must stay clean
  // until the user filters.
  if (merged.q) next.set('q', merged.q);
  merged.company.forEach((c) => next.append('company[]', c));
  merged.tier.forEach((t) => next.append('tier[]', t));
  if (merged.sort !== DEFAULTS.sort) next.set('sort', merged.sort);
  if (merged.dir !== DEFAULTS.dir) next.set('dir', merged.dir);
  if (merged.page !== DEFAULTS.page) next.set('page', String(merged.page));
  if (merged.per_page !== DEFAULTS.per_page) next.set('per_page', String(merged.per_page));
  return next;
}

// The ONE place useSearchParams is read for the list. No useState mirror of
// any of these fields exists anywhere else — a duplicate copy is how Back
// button behaviour and shareable links break.
export function useCustomerListParams(): [
  CustomerListParams,
  (patch: Partial<CustomerListParams>, options?: SetParamsOptions) => void,
  boolean,
] {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo(() => parseParams(searchParams), [searchParams]);

  const setParams = useCallback(
    (patch: Partial<CustomerListParams>, options: SetParamsOptions = {}) => {
      const { resetPage = true, replace = false } = options;

      // Merge against the search params at the time the update is applied
      // (react-router's functional setSearchParams form), not a snapshot
      // captured at render time — refs must never be read or written during
      // render.
      setSearchParams(
        (prevSearchParams) => {
          const merged: CustomerListParams = { ...parseParams(prevSearchParams), ...patch };
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

  const isFiltered = params.q !== '' || params.company.length > 0 || params.tier.length > 0;

  return [params, setParams, isFiltered];
}
