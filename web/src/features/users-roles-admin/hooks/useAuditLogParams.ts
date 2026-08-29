import { useCallback, useMemo } from 'react';
import { useSearchParams, type URLSearchParamsInit } from 'react-router-dom';

// The audit viewer's filters — actor, event type, and date range — live in URL
// search params, same convention as the users list and Story 03's customers
// list. Pagination is server-side; there is no client-side slice anywhere.

export type AuditLogParams = {
  actor_id: number | null;
  event: string[];
  from: string; // 'YYYY-MM-DD', '' when unset
  to: string; // 'YYYY-MM-DD', '' when unset
  q: string;
  page: number;
  per_page: number;
};

const DEFAULTS: AuditLogParams = {
  actor_id: null,
  event: [],
  from: '',
  to: '',
  q: '',
  page: 1,
  per_page: 25,
};

// Mirrors IndexAuditLogRequest::MAX_PER_PAGE. The server rejects anything
// larger; clamping here only avoids a guaranteed 422.
const MAX_PER_PAGE = 100;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type SetParamsOptions = { resetPage?: boolean; replace?: boolean };

function parseParams(searchParams: URLSearchParams): AuditLogParams {
  const rawActor = Number(searchParams.get('actor_id'));
  const rawPage = Number(searchParams.get('page'));
  const rawPerPage = Number(searchParams.get('per_page'));
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';

  return {
    actor_id: Number.isInteger(rawActor) && rawActor > 0 ? rawActor : DEFAULTS.actor_id,
    event: searchParams.getAll('event[]'),
    from: ISO_DATE.test(from) ? from : DEFAULTS.from,
    to: ISO_DATE.test(to) ? to : DEFAULTS.to,
    q: searchParams.get('q') ?? DEFAULTS.q,
    page: Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : DEFAULTS.page,
    per_page:
      Number.isInteger(rawPerPage) && rawPerPage >= 5 && rawPerPage <= MAX_PER_PAGE
        ? rawPerPage
        : DEFAULTS.per_page,
  };
}

function serializeParams(merged: AuditLogParams): URLSearchParams {
  const next = new URLSearchParams();
  if (merged.actor_id) next.set('actor_id', String(merged.actor_id));
  merged.event.forEach((e) => next.append('event[]', e));
  if (merged.from) next.set('from', merged.from);
  if (merged.to) next.set('to', merged.to);
  if (merged.q) next.set('q', merged.q);
  if (merged.page !== DEFAULTS.page) next.set('page', String(merged.page));
  if (merged.per_page !== DEFAULTS.per_page) next.set('per_page', String(merged.per_page));
  return next;
}

export function useAuditLogParams(): [
  AuditLogParams,
  (patch: Partial<AuditLogParams>, options?: SetParamsOptions) => void,
  boolean,
] {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo(() => parseParams(searchParams), [searchParams]);

  const setParams = useCallback(
    (patch: Partial<AuditLogParams>, options: SetParamsOptions = {}) => {
      const { resetPage = true, replace = false } = options;

      setSearchParams(
        (prevSearchParams) => {
          const merged: AuditLogParams = { ...parseParams(prevSearchParams), ...patch };
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

  const isFiltered =
    params.actor_id !== null ||
    params.event.length > 0 ||
    params.from !== '' ||
    params.to !== '' ||
    params.q !== '';

  return [params, setParams, isFiltered];
}
