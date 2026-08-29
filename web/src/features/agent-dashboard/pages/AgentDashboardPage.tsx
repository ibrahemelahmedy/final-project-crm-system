import { useAuth } from '../../auth/AuthContext';
import { greeting } from '../model/greeting';
import { useAgentSummary } from '../hooks/useDashboardQueries';
import { StatTile } from '../components/StatTile';
import { MyQueueWidget } from '../components/MyQueueWidget';
import { SlaRiskWidget } from '../components/SlaRiskWidget';
import { QuickRepliesWidget } from '../components/QuickRepliesWidget';

/**
 * Agent home (`/dashboard`). One of three sibling page components — not a
 * shared component with role branches. An Administrator who navigates here
 * directly sees this view scoped to their own assignments; Empty states are
 * then correct, not a bug.
 */
export function AgentDashboardPage() {
  const { user } = useAuth();
  const summary = useAgentSummary();
  const s = summary.data;

  return (
    <div className="dash-page">
      <header className="dash-head">
        <h1 className="dash-title">{greeting(user?.name ?? 'there')}</h1>
        <p className="dash-subtitle">Here's what needs your attention today</p>
      </header>

      <div className="stat-tile-row">
        <StatTile
          label="Assigned to me"
          value={s?.assigned_count ?? 0}
          loading={summary.isPending}
          error={summary.isError}
        />
        <StatTile
          label="Approaching SLA breach"
          value={s?.sla_risk_count ?? 0}
          tone="warning"
          loading={summary.isPending}
          error={summary.isError}
        />
        <StatTile
          label="Resolved today"
          value={s?.resolved_today_count ?? 0}
          tone="success"
          loading={summary.isPending}
          error={summary.isError}
        />
      </div>

      <div className="dash-grid dash-grid-agent">
        <MyQueueWidget />
        <div className="dash-col">
          <SlaRiskWidget />
          <QuickRepliesWidget />
        </div>
      </div>
    </div>
  );
}
