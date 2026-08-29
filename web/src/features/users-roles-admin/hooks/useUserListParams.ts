import { useCallback, useMemo } from 'react';
import { useSearchParams, type URLSearchParamsInit } from 'react-router-dom';
import { USER_ROLES, type UserRole, type UserStatusFilter } from '../model/adminUser';

// Same shape and conventions as Story 03's useCustomerListParams — filter and
// pagination state lives in URL search params and nowhere else, so Back works
// and a filtered list is a shareable link.

export type UserListParams = {
  q: string;
  role: UserRole[];
  department: string[];
  status: UserStatusFilter;
  sort: string; // default 'name'
  dir: 'asc' | 'desc'; // default 'asc'
  page: number; // default 1
  per_page: number; // default 25
};

// `status` defaults to 'active', matching the design's third chip
// ("Status: Active") and the server's own default.
const DEFAULTS: UserListParams = {
  q: '',
  role: [],
  department: [],
  status: 'active',
  sort: 'name',
  dir: 'asc',
  page: 1,
  per_page: 25,
};

const SORT_WHITELIST = ['name', 'email', 'role', 'department', 'last_login_at', 'created_at'];
const STATUS_WHITELIST: UserStatusFilter[] = ['active', 'inactive', 'all'];

type SetParamsOptions = { resetPage?: boolean; replace?: boolean };

function parseParams(searchParams: URLSearchParams): UserListParams {
  const rawSort = searchParams.get('sort');
  const sort = rawSort && SORT_WHITELIST.includes(rawSort) ? rawSort : DEFAULTS.sort;
  const rawStatus = searchParams.get('status') as UserStatusFilter | null;
  const status = rawStatus && STATUS_WHITELIST.includes(rawStatus) ? rawStatus : DEFAULTS.status;
  const rawPage = Number(searchParams.get('page'));
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : DEFAULTS.page;
  const rawPerPage = Number(searchParams.get('per_page'));
  const per_page =
    Number.isInteger(rawPerPage) && rawPerPage >= 5 && rawPerPage <= 100 ? rawPerPage : DEFAULTS.per_page;

  return {
    q: searchParams.get('q') ?? DEFAULTS.q,
    role: searchParams.getAll('role[]').filter((r): r is UserRole => USER_ROLES.includes(r as UserRole)),
    department: searchParams.getAll('department[]'),
    status,
    sort,
    dir: searchParams.get('dir') === 'desc' ? 'desc' : DEFAULTS.dir,
    page,
    per_page,
  };
}

function serializeParams(merged: UserListParams): URLSearchParams {
  const next = new URLSearchParams();
  // Defaults are never written to the URL — /users stays clean until the
  // Administrator actually filters.
  if (merged.q) next.set('q', merged.q);
  merged.role.forEach((r) => next.append('role[]', r));
  merged.department.forEach((d) => next.append('department[]', d));
  if (merged.status !== DEFAULTS.status) next.set('status', merged.status);
  if (merged.sort !== DEFAULTS.sort) next.set('sort', merged.sort);
  if (merged.dir !== DEFAULTS.dir) next.set('dir', merged.dir);
  if (merged.page !== DEFAULTS.page) next.set('page', String(merged.page));
  if (merged.per_page !== DEFAULTS.per_page) next.set('per_page', String(merged.per_page));
  return next;
}

// The ONE place useSearchParams is read for this list. No useState mirror of
// any of these fields exists anywhere else — a duplicate copy is how Back
// button behaviour and shareable links break.
export function useUserListParams(): [
  UserListParams,
  (patch: Partial<UserListParams>, options?: SetParamsOptions) => void,
  boolean,
] {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo(() => parseParams(searchParams), [searchParams]);

  const setParams = useCallback(
    (patch: Partial<UserListParams>, options: SetParamsOptions = {}) => {
      const { resetPage = true, replace = false } = options;

      // Merge against the search params at the time the update is applied
      // (react-router's functional setSearchParams form), not a snapshot
      // captured at render time.
      setSearchParams(
        (prevSearchParams) => {
          const merged: UserListParams = { ...parseParams(prevSearchParams), ...patch };
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

  // 'Status: Active' is the default view, so it does NOT by itself count as
  // filtered — otherwise the Empty state would always claim a filter is on.
  const isFiltered =
    params.q !== '' ||
    params.role.length > 0 ||
    params.department.length > 0 ||
    params.status !== DEFAULTS.status;

  return [params, setParams, isFiltered];
}

export const USER_LIST_DEFAULTS = DEFAULTS;
