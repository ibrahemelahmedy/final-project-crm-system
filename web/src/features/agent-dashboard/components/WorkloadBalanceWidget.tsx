import { useEffect, useState } from 'react';
import { useT } from '../../../i18n';
import { useTeamWorkload } from '../hooks/useDashboardQueries';
import { DashboardWidget } from './DashboardWidget';
import { widgetState, emptyList } from '../model/widgetState';

const initials = (name: string): string =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

/**
 * Workload Balance — one bar per active agent, width relative to the busiest
 * agent's open count. Zero agents renders an Empty state, never a
 * zero-height chart. Bars animate on mount; under `prefers-reduced-motion`
 * they render at final width immediately.
 */
export function WorkloadBalanceWidget() {
  const { t } = useT('dashboard');
  const query = useTeamWorkload();
  const state = widgetState(query, emptyList);
  const rows = query.data ?? [];
  const max = Math.max(1, ...rows.map((r) => r.open_count));

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <DashboardWidget
      title={t('workload.title')}
      state={state}
      onRetry={() => query.refetch()}
      errorMessage={t('workload.loadError')}
      emptyMessage={t('workload.empty')}
    >
      <div className="workload-list">
        {rows.map((r) => {
          const pct = Math.round((r.open_count / max) * 100);
          return (
            <div key={r.user_id} className="workload-row">
              <span className="workload-avatar" aria-hidden="true">
                {initials(r.name)}
              </span>
              <span className="workload-name">{r.name}</span>
              <span
                className="workload-track"
                role="meter"
                aria-valuenow={r.open_count}
                aria-valuemin={0}
                aria-valuemax={max}
                aria-label={t('workload.openTicketsAria', { name: r.name, count: r.open_count })}
              >
                <span
                  className="workload-fill"
                  style={{ inlineSize: mounted ? `${pct}%` : '0%' }}
                />
              </span>
              <span className="workload-count">
                <span dir="ltr" className="tq-ltr">
                  {r.open_count}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </DashboardWidget>
  );
}
