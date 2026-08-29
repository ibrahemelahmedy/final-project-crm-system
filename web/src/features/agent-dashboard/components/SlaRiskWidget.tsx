import { Link } from 'react-router-dom';
import { SlaCell } from '../../tickets';
import { useAgentSlaRisk } from '../hooks/useDashboardQueries';
import { DashboardWidget } from './DashboardWidget';
import { widgetState, emptyList } from '../model/widgetState';

/**
 * Approaching SLA Breach — up to five of the caller's tickets whose SLA risk
 * (from Story 06's shared calculator, surfaced via
 * `GET /api/dashboard/agent/sla-risk`) is at_risk or breached. No threshold is
 * computed here.
 */
export function SlaRiskWidget() {
  const query = useAgentSlaRisk();
  const state = widgetState(query, emptyList);
  const tickets = query.data ?? [];

  return (
    <DashboardWidget
      title={
        <span className="dw-title-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v6l4 2" />
          </svg>
          Approaching SLA Breach
        </span>
      }
      tone="warning"
      state={state}
      onRetry={() => query.refetch()}
      errorMessage="SLA risk couldn't load."
      emptyMessage="Nothing at risk right now — every assigned ticket is within its SLA."
      emptyAction={
        <Link className="dw-empty-link" to="/tickets">
          Review the full queue
        </Link>
      }
    >
      <ul className="sla-risk-list">
        {tickets.map((t) => (
          <li key={t.id}>
            <Link to={`/tickets/${t.id}`} className="sla-risk-item">
              <span className="sla-risk-subject">
                <span dir="ltr" className="tq-ltr">
                  {t.reference}
                </span>{' '}
                {t.subject}
              </span>
              <SlaCell sla={t.sla} />
            </Link>
          </li>
        ))}
      </ul>
    </DashboardWidget>
  );
}
