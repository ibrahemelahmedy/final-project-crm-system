import { Link } from 'react-router-dom';
import type { Ticket } from '../model/ticket';
import { useT, formatDateTime, formatRelative } from '../../../i18n';
import { ChannelIcon } from './ChannelIcon';
import { PriorityBadge } from './PriorityBadge';
import { StatusBadge } from './StatusBadge';
import { SlaCell } from './SlaCell';

type Props = {
  ticket: Ticket;
  zebra: boolean;
  selected: boolean;
  onToggle: (id: number) => void;
};

const ABSOLUTE_TIME_OPTIONS = {
  day: 'numeric' as const,
  month: 'short' as const,
  year: 'numeric' as const,
  hour: 'numeric' as const,
  minute: '2-digit' as const,
};

export function TicketRow({ ticket, zebra, selected, onToggle }: Props) {
  const { t } = useT('tickets');
  return (
    // The row is NOT a link and has no click handler — there is no
    // /tickets/{id} route until Story 05, so it also carries no cursor:pointer.
    <tr
      className="tq-row tq-body-row"
      data-zebra={zebra ? 'true' : 'false'}
      data-selected={selected ? 'true' : 'false'}
    >
      <td className="tq-cell tq-cell-select">
        <input
          type="checkbox"
          className="tq-checkbox"
          checked={selected}
          onChange={() => onToggle(ticket.id)}
          aria-label={t('row.selectTicket', { reference: ticket.reference })}
        />
      </td>

      <td className="tq-cell tq-cell-channel">
        <ChannelIcon channel={ticket.channel} label={ticket.channel_label} />
      </td>

      <td className="tq-cell tq-cell-id">
        {/* direction:ltr or "#4821" renders as "4821#" under RTL. */}
        <span className="tq-reference tq-ltr" dir="ltr">
          {ticket.reference}
        </span>
      </td>

      {/* min-inline-size:0 in CSS, or the ellipsis never triggers in a grid track. */}
      <td className="tq-cell tq-cell-subject">
        <Link to={`/tickets/${ticket.id}`} className="tq-subject tq-subject-link" title={ticket.subject}>
          {ticket.subject}
        </Link>
        <span className="tq-updated" title={formatDateTime(ticket.updated_at, ABSOLUTE_TIME_OPTIONS)}>
          {formatRelative(ticket.updated_at)}
        </span>
      </td>

      <td className="tq-cell tq-cell-customer">
        <span className="tq-customer">{ticket.customer?.name ?? '—'}</span>
      </td>

      <td className="tq-cell tq-cell-priority">
        <PriorityBadge priority={ticket.priority} label={ticket.priority_label} />
      </td>

      <td className="tq-cell tq-cell-status">
        <StatusBadge status={ticket.status} label={ticket.status_label} />
      </td>

      <td className="tq-cell tq-cell-assignee">
        {ticket.assignee ? (
          <span className="tq-assignee">
            <span className="tq-avatar" aria-hidden="true">
              {ticket.assignee.initials}
            </span>
            <span className="tq-assignee-name">{ticket.assignee.name}</span>
          </span>
        ) : (
          <span className="tq-unassigned">{t('unassigned')}</span>
        )}
      </td>

      <td className="tq-cell tq-cell-sla">
        <SlaCell sla={ticket.sla} />
      </td>
    </tr>
  );
}
