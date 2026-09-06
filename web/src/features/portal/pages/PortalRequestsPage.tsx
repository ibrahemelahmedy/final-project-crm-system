import React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useT } from '../../../i18n';
import { usePortalRequestsList } from '../hooks/usePortalRequests';
import { usePortalSession } from '../hooks/usePortalSession';
import { RequestList } from '../components/RequestList';
import { PortalTabs } from '../components/PortalTabs';
import { PortalPagination } from '../components/PortalPagination';
import { PortalEmpty, PortalError, PortalSkeleton } from '../components/PortalStates';

/**
 * Story 17 (WIS-16) — AC3, "track requests": the caller's OPEN tickets only
 * (`?scope=open`; the server, not the client, decides what "open" means).
 * Undesigned screen (Decision 3), built from the design system with all four
 * async states. Page number lives in the URL.
 */
export const PortalRequestsPage: React.FC = () => {
  const { t } = useT('portal');
  const navigate = useNavigate();
  const { signOut } = usePortalSession();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Math.max(Number(searchParams.get('page') ?? '1') || 1, 1);
  const query = usePortalRequestsList('open', page);

  const setPage = (next: number) => {
    const params = new URLSearchParams(searchParams);
    if (next <= 1) params.delete('page');
    else params.set('page', String(next));
    setSearchParams(params);
  };

  const onSignOut = () => {
    signOut();
    navigate('/portal', { replace: true });
  };

  return (
    <div className="portal-card portal-wide">
      <div className="portal-page-head">
        <h1 className="portal-heading">{t('requests.title')}</h1>
        <Link to="/portal/requests/new" className="portal-btn portal-btn-inline fv">
          {t('requests.new')}
        </Link>
      </div>

      <PortalTabs />

      {query.isPending && <PortalSkeleton label={t('requests.loading')} />}

      {query.isError && <PortalError message={t('requests.error')} onRetry={() => query.refetch()} />}

      {query.isSuccess &&
        (query.data.data.length === 0 ? (
          <PortalEmpty
            message={t('requests.empty')}
            action={
              <Link to="/portal/requests/new" className="portal-link">
                {t('requests.emptyAction')}
              </Link>
            }
          />
        ) : (
          <>
            <RequestList tickets={query.data.data} />
            <PortalPagination
              currentPage={query.data.meta.current_page}
              lastPage={query.data.meta.last_page}
              onChange={setPage}
            />
          </>
        ))}

      <p className="portal-footer-note">
        <button type="button" className="portal-link fv" onClick={onSignOut}>
          {t('nav.signOut')}
        </button>
      </p>
    </div>
  );
};
