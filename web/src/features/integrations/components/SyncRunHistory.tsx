import { useState } from 'react';
import { useT } from '../../../i18n';
import { useSyncRuns } from '../hooks/useSyncRuns';
import { SyncRunSkeleton } from './SyncRunSkeleton';
import { SyncEmpty } from './SyncEmpty';
import { SyncRunRow } from './SyncRunRow';
import type { IntegrationTypeValue } from '../model/types';

type Props = { type: IntegrationTypeValue };

/**
 * Story 25 (WIS-24), Task 52. Ships all four async states (index
 * cross-cutting rule): Loading, Error, Empty, Success.
 */
export function SyncRunHistory({ type }: Props) {
  const { t } = useT('integrations');
  const [page, setPage] = useState(1);
  const query = useSyncRuns(type, page);

  if (query.isPending) return <SyncRunSkeleton />;

  if (query.isError) {
    return (
      <div className="intg-state" role="alert">
        <h4 className="intg-state-title">{t('error.loadTitle')}</h4>
        <p className="intg-state-body">{t('error.loadBody')}</p>
        <button type="button" className="dt-btn dt-btn-primary" onClick={() => void query.refetch()}>
          {t('error.retry')}
        </button>
      </div>
    );
  }

  const runs = query.data.data;
  const meta = query.data.meta;

  if (runs.length === 0) return <SyncEmpty />;

  return (
    <div className="intg-run-history">
      <ul className="intg-run-list">
        {runs.map((run) => (
          <SyncRunRow key={run.id} run={run} />
        ))}
      </ul>

      {meta.last_page > 1 && (
        <div className="intg-run-pager">
          <button type="button" className="dt-btn dt-btn-outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {t('sync.prevPage')}
          </button>
          <span>{t('sync.pageOf', { page: meta.current_page, total: meta.last_page })}</span>
          <button
            type="button"
            className="dt-btn dt-btn-outline"
            disabled={page >= meta.last_page}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('sync.nextPage')}
          </button>
        </div>
      )}
    </div>
  );
}
