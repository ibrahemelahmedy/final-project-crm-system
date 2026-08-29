import type { NotificationFilter } from '../model/notification';

/** One keying scheme for every notification query. */
export const notificationKeys = {
  all: ['notifications'] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
  list: (filter: NotificationFilter, page: number) =>
    [...notificationKeys.all, 'list', filter, page] as const,
};
