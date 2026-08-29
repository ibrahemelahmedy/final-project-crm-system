import { NotificationIcon } from './NotificationIcon';
import { formatNotificationTime } from '../model/notificationTime';
import type { Notification } from '../model/notification';

type Props = {
  notification: Notification;
  onActivate: (notification: Notification) => void;
};

/**
 * One row, shared by the panel and the full page. An unread row is marked by
 * more than colour (brief.md's accessibility rules): the dot AND the tinted
 * background AND bold weight, not the background alone.
 */
export function NotificationRow({ notification, onActivate }: Props) {
  const isUnread = notification.read_at === null;
  const canNavigate = notification.source_available && notification.link_to !== null;

  return (
    <div
      role="listitem"
      className={`notif-row ${isUnread ? 'notif-row-unread' : 'notif-row-read'}`}
      data-source-available={notification.source_available}
    >
      <button
        type="button"
        className="notif-row-btn fv"
        onClick={() => onActivate(notification)}
      >
        <NotificationIcon tone={notification.tone} />
        <span className="notif-row-body">
          <span className="notif-row-meta">
            {isUnread && <span className="notif-row-dot" aria-hidden="true" />}
            <span className="notif-row-type">{notification.type_label}</span>
            <span className="notif-row-time">{formatNotificationTime(notification.created_at)}</span>
          </span>
          <span className="notif-row-title">{notification.title}</span>
          {!canNavigate && (
            <span className="notif-row-unavailable">No longer available</span>
          )}
        </span>
      </button>
    </div>
  );
}
