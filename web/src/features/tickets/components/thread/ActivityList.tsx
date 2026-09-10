import type { TicketEvent } from '../../model/ticket';
import { useT, formatDateTime, formatRelative } from '../../../../i18n';
import {
  STATUS_FALLBACK_LABELS,
  PRIORITY_FALLBACK_LABELS,
  CATEGORY_FALLBACK_LABELS,
} from '../../model/display';

const ABSOLUTE_TIME_OPTIONS = {
  day: 'numeric' as const,
  month: 'short' as const,
  year: 'numeric' as const,
  hour: 'numeric' as const,
  minute: '2-digit' as const,
};

// Pinned to the backend's event vocabulary. Write sites:
//   api/app/Models/Ticket.php (created, status/priority/category_changed,
//     assigned, unassigned, reopened, auto_assigned, escalated, auto_closed)
//   api/app/Http/Controllers/TicketMessageController.php (replied,
//     internal_note_added, mentioned)
const EVENT_KEYS: Record<string, string> = {
  created: 'activity.created',
  status_changed: 'activity.statusChanged',
  priority_changed: 'activity.priorityChanged',
  category_changed: 'activity.categoryChanged',
  assigned: 'activity.assigned',
  unassigned: 'activity.unassigned',
  reopened: 'activity.reopened',
  replied: 'activity.replied',
  auto_assigned: 'activity.autoAssigned',
  escalated: 'activity.escalated',
  auto_closed: 'activity.autoClosed',
  internal_note_added: 'activity.internalNoteAdded',
  mentioned: 'activity.mentioned',
};

export function ActivityList({ events }: { events: TicketEvent[] }) {
  const { t } = useT('conversation');
  // `new_value` on a *_changed event is a raw enum value; translate it in the
  // `tickets` namespace before it is interpolated. `assigned` / `escalated` /
  // `auto_assigned` carry a user id in `new_value` — their catalogue strings
  // never interpolate {{value}}.
  const { t: tt } = useT('tickets');
  const recent = events.slice(0, 10);

  const translatedValue = (event: TicketEvent): string | undefined => {
    const raw = event.new_value ?? '';
    if (event.event === 'status_changed') {
      return STATUS_FALLBACK_LABELS[raw as keyof typeof STATUS_FALLBACK_LABELS]
        ? tt(STATUS_FALLBACK_LABELS[raw as keyof typeof STATUS_FALLBACK_LABELS])
        : (event.new_value ?? undefined);
    }
    if (event.event === 'priority_changed') {
      return PRIORITY_FALLBACK_LABELS[raw as keyof typeof PRIORITY_FALLBACK_LABELS]
        ? tt(PRIORITY_FALLBACK_LABELS[raw as keyof typeof PRIORITY_FALLBACK_LABELS])
        : (event.new_value ?? undefined);
    }
    if (event.event === 'category_changed') {
      return CATEGORY_FALLBACK_LABELS[raw]
        ? tt(CATEGORY_FALLBACK_LABELS[raw])
        : (event.new_value ?? undefined);
    }
    return event.new_value ?? undefined;
  };

  const sentence = (event: TicketEvent): string => {
    const who = event.actor?.name ?? t('activity.deletedUser');
    const key = EVENT_KEYS[event.event];
    if (key) return t(key, { who, value: translatedValue(event) });
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
