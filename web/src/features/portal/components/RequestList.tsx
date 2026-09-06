import React from 'react';
import { Link } from 'react-router-dom';
import { useT, formatDate, formatRelative } from '../../../i18n';
import { RequestStatusBadge } from './RequestStatusBadge';
import type { PortalTicket } from '../model/portal';

type RequestListProps = {
  tickets: PortalTicket[];
  showResolvedDate?: boolean;
};

export const RequestList: React.FC<RequestListProps> = ({ tickets, showResolvedDate }) => {
  const { t } = useT('portal');

  return (
    <ul className="portal-list">
      {tickets.map((ticket) => (
        <li key={ticket.id}>
          <Link to={`/portal/requests/${ticket.id}`} className="portal-list-row fv">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
              <strong>{ticket.subject}</strong>
              <RequestStatusBadge status={ticket.status} label={ticket.status_label} />
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', marginBlockStart: '6px' }}>
              {showResolvedDate && ticket.resolved_at
                ? t('history.resolvedOn', { date: formatDate(ticket.resolved_at) })
                : t('requests.lastActivity', { time: formatRelative(ticket.last_activity_at) })}
              {' · '}
              {t('requests.messageCount', { count: ticket.message_count })}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
};
