import type { TicketEvent } from '../../model/ticket';
import { useT, formatDateTime, formatRelative } from '../../../../i18n';

const ABSOLUTE_TIME_OPTIONS = {
  day: 'numeric' as const,
  month: 'short' as const,
  year: 'numeric' as const,
  hour: 'numeric' as const,
  minute: '2-digit' as const,
};

const EVENT_KEYS: Record<string, string> = {
  created: 'activity.created',
  status_changed: 'activity.statusChanged',
  priority_changed: 'activity.priorityChanged',
  category_changed: 'activity.categoryChanged',
  assigned: 'activity.assigned',
  unassigned: 'activity.unassigned',
  reopened: 'activity.reopened',
  replied: 'activity.replied',
};

export function ActivityList({ events }: { events: TicketEvent[] }) {
  const { t } = useT('conversation');
  const recent = events.slice(0, 10);

  const sentence = (event: TicketEvent): string => {
    const who = event.actor?.name ?? t('activity.deletedUser');
    const key = EVENT_KEYS[event.event];
    if (key) return t(key, { who, value: event.new_value });
    return t('activity.generic', { who, event: event.event });
  };

  return (
    <section>
      <p className="meta-section-label">{t('section.activity')}</p>
      {recent.length === 0 ? (
        <p className="customer-card-line">{t('activity.empty')}</p>
      ) : (
        <ol className="activity-list">
          {recent.map((event) => (
            <li key={event.id} className="activity-row">
              <span>{sentence(event)}</span>
              <time
                className="activity-time"
                dateTime={event.created_at}
                title={formatDateTime(event.created_at, ABSOLUTE_TIME_OPTIONS)}
              >
                {formatRelative(event.created_at)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
