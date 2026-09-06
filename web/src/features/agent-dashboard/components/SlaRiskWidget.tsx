import { Link } from 'react-router-dom';
import { SlaCell } from '../../tickets';
import { useT } from '../../../i18n';
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
  const { t } = useT('dashboard');
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
          {t('slaRisk.title')}
        </span>
      }
      tone="warning"
      state={state}
      onRetry={() => query.refetch()}
      errorMessage={t('slaRisk.loadError')}
      emptyMessage={t('slaRisk.empty')}
      emptyAction={
        <Link className="dw-empty-link" to="/tickets">
          {t('slaRisk.reviewQueue')}
        </Link>
      }
    >
      <ul className="sla-risk-list">
        {tickets.map((ticket) => (
          <li key={ticket.id}>
            <Link to={`/tickets/${ticket.id}`} className="sla-risk-item">
              <span className="sla-risk-subject">
                <span dir="ltr" className="tq-ltr">
                  {ticket.reference}
                </span>{' '}
                {ticket.subject}
              </span>
              <SlaCell sla={ticket.sla} />
            </Link>
          </li>
        ))}
      </ul>
    </DashboardWidget>
  );
}
