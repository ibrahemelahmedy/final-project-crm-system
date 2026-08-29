import { useNavigate } from 'react-router-dom';
import { useNotificationListParams } from '../hooks/useNotificationListParams';
import { useNotificationsList, useMarkAllNotificationsRead, useMarkNotificationRead } from '../hooks/useNotifications';
import { NotificationRow } from '../components/NotificationRow';
import { Pagination } from '../../../components/data-table/Pagination';
import type { Notification } from '../model/notification';

const PAGE_LOADING_ROWS = 6;

/**
 * The full Notifications Centre — WisalNotifications-*.dc.html plus its own
 * server-paginated list. Filter and page both live in URL search params
 * (brief.md's cross-cutting rule); the table is never fetched in full.
 */
export function NotificationsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useNotificationListParams();
  const { data, isLoading, isError, refetch, isPlaceholderData } = useNotificationsList(
    params.filter,
    params.page
  );
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const rows = data?.data ?? [];
  const hasUnread = rows.some((row) => row.read_at === null);

  const activate = (notification: Notification) => {
    if (notification.read_at === null) {
      markRead.mutate(notification.id);
    }
    if (notification.source_available && notification.link_to) {
      navigate(notification.link_to);
    }
  };

  return (
    <div className="notif-page">
      <div className="notif-page-header">
        <h1 className="notif-page-title">Notifications</h1>
        <div className="notif-page-controls">
          <div className="notif-filter-group" role="group" aria-label="Filter notifications">
            <button
              type="button"
              className="notif-filter-btn fv"
              data-active={params.filter === 'all'}
              onClick={() => setParams({ filter: 'all' })}
            >
              All
            </button>
            <button
              type="button"
              className="notif-filter-btn fv"
              data-active={params.filter === 'unread'}
              onClick={() => setParams({ filter: 'unread' })}
            >
              Unread
            </button>
          </div>
          <button
            type="button"
            className="notif-mark-all-btn fv"
            onClick={() => markAllRead.mutate()}
            disabled={!hasUnread || markAllRead.isPending}
          >
            Mark all as read
          </button>
        </div>
      </div>

      <div className="notif-page-card">
        {isLoading && (
          <div className="notif-list" aria-busy="true">
            {Array.from({ length: PAGE_LOADING_ROWS }).map((_, i) => (
              <div key={i} className="notif-row notif-row-skeleton">
                <span className="notif-skeleton notif-skeleton-icon" />
                <span className="notif-row-body">
                  <span className="notif-skeleton notif-skeleton-line" style={{ width: '30%' }} />
                  <span className="notif-skeleton notif-skeleton-line" style={{ width: '80%' }} />
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
          <div role="list" className="notif-list" data-dimmed={isPlaceholderData}>
            {rows.map((row) => (
              <NotificationRow key={row.id} notification={row} onActivate={activate} />
            ))}
          </div>
        )}

        {data && data.meta.total > 0 && (
          <Pagination
            currentPage={data.meta.current_page}
            lastPage={data.meta.last_page}
            total={data.meta.total}
            perPage={data.meta.per_page}
            onPageChange={(page) => setParams({ page })}
          />
        )}
      </div>
    </div>
  );
}
