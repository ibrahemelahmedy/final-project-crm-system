import type { TicketEvent } from '../../model/ticket';
import { formatAbsoluteTime, formatRelativeTime } from '../../model/display';

function sentence(event: TicketEvent): string {
  const who = event.actor?.name ?? 'Deleted user';
  switch (event.event) {
    case 'created':
      return `${who} created the ticket`;
    case 'status_changed':
      return `${who} changed status to ${event.new_value}`;
    case 'priority_changed':
      return `${who} changed priority to ${event.new_value}`;
    case 'category_changed':
      return `${who} changed category to ${event.new_value}`;
    case 'assigned':
      return `${who} assigned the ticket`;
    case 'unassigned':
      return `${who} unassigned the ticket`;
    case 'reopened':
      return `${who} reopened the ticket`;
    case 'replied':
      return `${who} replied`;
    default:
      return `${who} — ${event.event}`;
  }
}

export function ActivityList({ events }: { events: TicketEvent[] }) {
  const recent = events.slice(0, 10);

  return (
    <section>
      <p className="meta-section-label">ACTIVITY</p>
      {recent.length === 0 ? (
        <p className="customer-card-line">No activity yet.</p>
      ) : (
        <ol className="activity-list">
          {recent.map((event) => (
            <li key={event.id} className="activity-row">
              <span>{sentence(event)}</span>
              <time
                className="activity-time"
                dateTime={event.created_at}
                title={formatAbsoluteTime(event.created_at)}
              >
                {formatRelativeTime(event.created_at)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
