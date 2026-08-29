import { useNavigate } from 'react-router-dom';
import { useNotificationsList, useMarkAllNotificationsRead, useMarkNotificationRead } from '../hooks/useNotifications';
import { NotificationRow } from './NotificationRow';
import type { Notification } from '../model/notification';

type Props = {
  /** Called after a row is activated (navigate or not) — closes the panel. */
  onRowActivated?: () => void;
};

const PANEL_LOADING_ROWS = 4;

/**
 * The popup's contents — WisalNotifications-*.dc.html "Success (panel
 * open)" plus its Loading / Empty / Error compositions. A separate component
 * from NotificationBell so the trigger button and the panel body can be
 * tested and reasoned about independently.
 */
export function NotificationPanel({ onRowActivated }: Props) {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useNotificationsList('all', 1);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const rows = data?.data ?? [];
  const hasUnread = rows.some((row) => row.read_at === null);

  const activate = (notification: Notification) => {
    if (notification.read_at === null) {
      markRead.mutate(notification.id);
    }
    onRowActivated?.();
    if (notification.source_available && notification.link_to) {
      navigate(notification.link_to);
    }
  };

  return (
    <div role="dialog" aria-label="Notifications" className="notif-panel">
      <div className="notif-panel-header">
        <span className="notif-panel-title">Notifications</span>
        <button
          type="button"
          className="notif-mark-all-btn fv"
          onClick={() => markAllRead.mutate()}
          disabled={!hasUnread || markAllRead.isPending}
        >
          Mark all as read
        </button>
      </div>

      {isLoading && (
        <div className="notif-list" aria-busy="true">
          {Array.from({ length: PANEL_LOADING_ROWS }).map((_, i) => (
            <div key={i} className="notif-row notif-row-skeleton">
              <span className="notif-skeleton notif-skeleton-icon" />
              <span className="notif-row-body">
                <span className="notif-skeleton notif-skeleton-line" style={{ width: '35%' }} />
                <span className="notif-skeleton notif-skeleton-line" style={{ width: '85%' }} />
              </span>
            </div>
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <div className="notif-error">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16h.01" />
          </svg>
          <div className="notif-error-title">Couldn't load notifications</div>
          <div className="notif-error-body">Check your connection and try again.</div>
          <button type="button" className="notif-retry-btn fv" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <div className="notif-empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7M9.5 19a2.5 2.5 0 0 0 5 0" />
          </svg>
          <div className="notif-empty-title">You're all caught up</div>
          <div className="notif-empty-body">No notifications right now — check back later.</div>
        </div>
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <div role="list" className="notif-list">
          {rows.map((row) => (
            <NotificationRow key={row.id} notification={row} onActivate={activate} />
          ))}
        </div>
      )}

      <div className="notif-panel-footer">
        <a
          href="/notifications"
          className="notif-view-all-link fv"
          onClick={(e) => {
            e.preventDefault();
            onRowActivated?.();
            navigate('/notifications');
          }}
        >
          View all notifications
        </a>
      </div>
    </div>
  );
}
