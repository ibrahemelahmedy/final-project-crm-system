import { useCallback, useMemo } from 'react';
import { useSearchParams, type URLSearchParamsInit } from 'react-router-dom';
import type { NotificationFilter } from '../model/notification';

// The read/unread filter and the page both live in URL search params — same
// convention as the audit log viewer and every other data screen — so the
// Back button and a shared link work exactly as they do elsewhere.

export type NotificationListParams = {
  filter: NotificationFilter;
  page: number;
};

const DEFAULTS: NotificationListParams = { filter: 'all', page: 1 };

function parseParams(searchParams: URLSearchParams): NotificationListParams {
  const rawFilter = searchParams.get('filter');
  const rawPage = Number(searchParams.get('page'));

  return {
    filter: rawFilter === 'unread' ? 'unread' : DEFAULTS.filter,
    page: Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : DEFAULTS.page,
  };
}

export function useNotificationListParams(): [
  NotificationListParams,
  (patch: Partial<NotificationListParams>) => void,
] {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useMemo(() => parseParams(searchParams), [searchParams]);

  const setParams = useCallback(
    (patch: Partial<NotificationListParams>) => {
      setSearchParams((prev) => {
        const merged: NotificationListParams = { ...parseParams(prev), ...patch };
        // Changing the filter always resets to page 1 — a stale page number
        // past the end of a narrower result set is a blank page, not a bug
        // report waiting to happen.
        if ('filter' in patch && !('page' in patch)) merged.page = 1;

        const next = new URLSearchParams();
        if (merged.filter !== DEFAULTS.filter) next.set('filter', merged.filter);
        if (merged.page !== DEFAULTS.page) next.set('page', String(merged.page));
        return next as unknown as URLSearchParamsInit;
      });
    },
    [setSearchParams]
  );

  return [params, setParams];
}
