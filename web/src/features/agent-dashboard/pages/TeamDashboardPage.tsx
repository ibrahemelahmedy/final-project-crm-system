import { useT } from '../../../i18n';
import { useTeamSummary } from '../hooks/useDashboardQueries';
import { StatTile } from '../components/StatTile';
import { WorkloadBalanceWidget } from '../components/WorkloadBalanceWidget';
import { EscalationsWidget } from '../components/EscalationsWidget';

/**
 * Team Lead home (`/dashboard/team`). Team-scoped content — not the
 * single-agent view. Server-side gate on every `/api/dashboard/team/*`
 * endpoint backs the route guard.
 */
export function TeamDashboardPage() {
  const { t } = useT('dashboard');
  const summary = useTeamSummary();
  const s = summary.data;

  const compliance =
    s == null || s.sla_compliance_pct == null ? '—' : `${s.sla_compliance_pct}%`;

  return (
    <div className="dash-page">
      <header className="dash-head">
        <h1 className="dash-title">{t('team.heading')}</h1>
        <p className="dash-subtitle">
          {s ? (
            <>
              {s.team_name} ·{' '}
              <span dir="ltr" className="tq-ltr">
                {s.agent_count}
              </span>{' '}
              {t('team.agentCount', { count: s.agent_count })}
            </>
          ) : (
            t('team.loading')
          )}
        </p>
      </header>

      <div className="stat-tile-row">
        <StatTile
          label={t('team.openTickets')}
          value={s?.open_count ?? 0}
          loading={summary.isPending}
          error={summary.isError}
        />
        <StatTile
          label={t('team.activeEscalations')}
          value={s?.escalation_count ?? 0}
          tone="danger"
          loading={summary.isPending}
          error={summary.isError}
        />
        <StatTile
          label={t('team.slaCompliance')}
          value={compliance}
          tone="success"
          loading={summary.isPending}
          error={summary.isError}
        />
      </div>

      <div className="dash-grid dash-grid-team">
        <WorkloadBalanceWidget />
        <EscalationsWidget />
      </div>
    </div>
  );
}
