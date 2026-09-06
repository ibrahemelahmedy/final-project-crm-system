import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useT } from '../../../i18n';
import { usePortalRequestsList } from '../hooks/usePortalRequests';
import { RequestList } from '../components/RequestList';
import { PortalTabs } from '../components/PortalTabs';
import { PortalPagination } from '../components/PortalPagination';
import { PortalEmpty, PortalError, PortalSkeleton } from '../components/PortalStates';

/**
 * Story 17 (WIS-16) — AC4, "past tickets and resolutions": `?scope=past`.
 * A SEPARATE route from AC3's rather than a client-side toggle on one screen,
 * so a reviewer can assert the two criteria independently. Same RequestList,
 * with the resolution date in place of last activity.
 */
export const PortalHistoryPage: React.FC = () => {
  const { t } = useT('portal');
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Math.max(Number(searchParams.get('page') ?? '1') || 1, 1);
  const query = usePortalRequestsList('past', page);

  const setPage = (next: number) => {
    const params = new URLSearchParams(searchParams);
    if (next <= 1) params.delete('page');
    else params.set('page', String(next));
    setSearchParams(params);
  };

  return (
    <div className="portal-card portal-wide">
      <div className="portal-page-head">
        <h1 className="portal-heading">{t('history.title')}</h1>
      </div>

      <PortalTabs />

      {query.isPending && <PortalSkeleton label={t('history.loading')} />}

      {query.isError && <PortalError message={t('history.error')} onRetry={() => query.refetch()} />}

      {query.isSuccess &&
        (query.data.data.length === 0 ? (
          <PortalEmpty
            message={t('history.empty')}
            action={
              <Link to="/portal/requests" className="portal-link">
                {t('history.emptyAction')}
              </Link>
            }
          />
        ) : (
          <>
            <RequestList tickets={query.data.data} showResolvedDate />
            <PortalPagination
              currentPage={query.data.meta.current_page}
              lastPage={query.data.meta.last_page}
              onChange={setPage}
            />
          </>
        ))}
    </div>
  );
};
