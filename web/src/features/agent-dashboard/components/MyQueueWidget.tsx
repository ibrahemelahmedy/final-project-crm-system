import { Link } from 'react-router-dom';
import { PriorityBadge, SlaCell } from '../../tickets';
import { useT } from '../../../i18n';
import { useAgentQueue } from '../hooks/useDashboardQueries';
import { DashboardWidget } from './DashboardWidget';
import { widgetState, emptyList } from '../model/widgetState';

/**
 * My Queue — subject · customer · priority · SLA left, up to five of the
 * caller's own open tickets, most-urgent first. Reads
 * `GET /api/dashboard/agent/queue`; owns its own query and four states.
 */
export function MyQueueWidget() {
  const { t } = useT('dashboard');
  const query = useAgentQueue();
  const state = widgetState(query, emptyList);
  const tickets = query.data ?? [];

  return (
    <DashboardWidget
      title={t('myQueue.title')}
      state={state}
      onRetry={() => query.refetch()}
      errorMessage={t('myQueue.loadError')}
      emptyMessage={t('myQueue.empty')}
      emptyAction={
        <Link className="dw-empty-link" to="/tickets">
          {t('myQueue.browseQueue')}
        </Link>
      }
    >
      <div className="mq-table" role="table" aria-label={t('myQueue.ariaLabel')}>
        <div className="mq-row mq-head" role="row">
          <span role="columnheader">{t('myQueue.columns.id')}</span>
          <span role="columnheader">{t('myQueue.columns.subject')}</span>
          <span role="columnheader">{t('myQueue.columns.customer')}</span>
          <span role="columnheader">{t('myQueue.columns.priority')}</span>
          <span role="columnheader">{t('myQueue.columns.slaLeft')}</span>
        </div>
        {tickets.map((ticket) => (
          <Link key={ticket.id} to={`/tickets/${ticket.id}`} className="mq-row mq-body" role="row">
            <span role="cell" className="mq-id">
              <span dir="ltr" className="tq-ltr">
                {ticket.reference}
              </span>
            </span>
            <span role="cell" className="mq-subject">
              {ticket.subject}
            </span>
            <span role="cell" className="mq-customer">
              {ticket.customer?.name ?? '—'}
            </span>
            <span role="cell">
              <PriorityBadge priority={ticket.priority} label={ticket.priority_label} />
            </span>
            <span role="cell">
              <SlaCell sla={ticket.sla} />
            </span>
          </Link>
        ))}
      </div>
    </DashboardWidget>
  );
}
