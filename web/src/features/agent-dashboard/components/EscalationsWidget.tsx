import { Link } from 'react-router-dom';
import { PriorityBadge } from '../../tickets';
import { useT, formatRelative } from '../../../i18n';
import { useTeamEscalations } from '../hooks/useDashboardQueries';
import { DashboardWidget } from './DashboardWidget';
import { widgetState, emptyList } from '../model/widgetState';

/**
 * Current Escalations — escalated tickets with the escalator's name and age.
 * Acting on an escalation (reassign / resolve) is out of scope: the row links
 * to the ticket and Stories 04/05 own the action.
 */
export function EscalationsWidget() {
  const { t } = useT('dashboard');
  const query = useTeamEscalations();
  const state = widgetState(query, emptyList);
  const rows = query.data ?? [];

  return (
    <DashboardWidget
      title={t('escalations.title')}
      state={state}
      onRetry={() => query.refetch()}
      errorMessage={t('escalations.loadError')}
      emptyMessage={t('escalations.empty')}
    >
      <ul className="escalation-list">
        {rows.map((item) => (
          <li key={item.id}>
            <Link to={`/tickets/${item.id}`} className="escalation-item">
              <span className="escalation-main">
                <span className="escalation-subject">
                  <span dir="ltr" className="tq-ltr">
                    {item.reference}
                  </span>{' '}
                  {item.subject}
                </span>
                <span className="escalation-meta">
                  {t('escalations.escalatedBy', { name: item.escalated_by_name ?? t('escalations.unknown') })}
                  {item.escalated_at ? ` · ${formatRelative(item.escalated_at)}` : ''}
                </span>
              </span>
              <PriorityBadge priority={item.priority} label={item.priority_label} />
            </Link>
          </li>
        ))}
      </ul>
    </DashboardWidget>
  );
}
