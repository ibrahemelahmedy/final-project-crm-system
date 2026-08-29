import { Link } from 'react-router-dom';
import { PriorityBadge, SlaCell } from '../../tickets';
import { useAgentQueue } from '../hooks/useDashboardQueries';
import { DashboardWidget } from './DashboardWidget';
import { widgetState, emptyList } from '../model/widgetState';

/**
 * My Queue — subject · customer · priority · SLA left, up to five of the
 * caller's own open tickets, most-urgent first. Reads
 * `GET /api/dashboard/agent/queue`; owns its own query and four states.
 */
export function MyQueueWidget() {
  const query = useAgentQueue();
  const state = widgetState(query, emptyList);
  const tickets = query.data ?? [];

  return (
    <DashboardWidget
      title="My Queue"
      state={state}
      onRetry={() => query.refetch()}
      errorMessage="Your queue couldn't load."
      emptyMessage="No tickets assigned to you yet — new work will show up here."
      emptyAction={
        <Link className="dw-empty-link" to="/tickets">
          Browse the ticket queue
        </Link>
      }
    >
      <div className="mq-table" role="table" aria-label="My queue">
        <div className="mq-row mq-head" role="row">
          <span role="columnheader">ID</span>
          <span role="columnheader">SUBJECT</span>
          <span role="columnheader">CUSTOMER</span>
          <span role="columnheader">PRIORITY</span>
          <span role="columnheader">SLA LEFT</span>
        </div>
        {tickets.map((t) => (
          <Link key={t.id} to={`/tickets/${t.id}`} className="mq-row mq-body" role="row">
            <span role="cell" className="mq-id">
              <span dir="ltr" className="tq-ltr">
                {t.reference}
              </span>
            </span>
            <span role="cell" className="mq-subject">
              {t.subject}
            </span>
            <span role="cell" className="mq-customer">
              {t.customer?.name ?? '—'}
            </span>
            <span role="cell">
              <PriorityBadge priority={t.priority} label={t.priority_label} />
            </span>
            <span role="cell">
              <SlaCell sla={t.sla} />
            </span>
          </Link>
        ))}
      </div>
    </DashboardWidget>
  );
}
