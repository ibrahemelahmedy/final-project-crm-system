import { Link } from 'react-router-dom';
import { PriorityBadge } from '../../tickets';
import { formatRelativeTime } from '../../tickets/model/display';
import { useTeamEscalations } from '../hooks/useDashboardQueries';
import { DashboardWidget } from './DashboardWidget';
import { widgetState, emptyList } from '../model/widgetState';

/**
 * Current Escalations — escalated tickets with the escalator's name and age.
 * Acting on an escalation (reassign / resolve) is out of scope: the row links
 * to the ticket and Stories 04/05 own the action.
 */
export function EscalationsWidget() {
  const query = useTeamEscalations();
  const state = widgetState(query, emptyList);
  const rows = query.data ?? [];

  return (
    <DashboardWidget
      title="Current Escalations"
      state={state}
      onRetry={() => query.refetch()}
      errorMessage="Escalations couldn't load."
      emptyMessage="No active escalations. Tickets raised to you by an agent will appear here."
    >
      <ul className="escalation-list">
        {rows.map((t) => (
          <li key={t.id}>
            <Link to={`/tickets/${t.id}`} className="escalation-item">
              <span className="escalation-main">
                <span className="escalation-subject">
                  <span dir="ltr" className="tq-ltr">
                    {t.reference}
                  </span>{' '}
                  {t.subject}
                </span>
                <span className="escalation-meta">
                  Escalated by {t.escalated_by_name ?? 'Unknown'}
                  {t.escalated_at ? ` · ${formatRelativeTime(t.escalated_at)}` : ''}
                </span>
              </span>
              <PriorityBadge priority={t.priority} label={t.priority_label} />
            </Link>
          </li>
        ))}
      </ul>
    </DashboardWidget>
  );
}
