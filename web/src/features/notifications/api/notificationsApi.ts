import { api } from '../../../lib/api';
import type { Notification, NotificationFilter, Paginated } from '../model/notification';

export async function fetchUnreadCount(): Promise<number> {
  const { data } = await api.get<{ count: number }>('/notifications/unread-count');
  return data.count;
}

export async function fetchNotifications(
  filter: NotificationFilter,
  page: number,
  perPage = 20
): Promise<Paginated<Notification>> {
  const { data } = await api.get('/notifications', {
    params: { filter, page, per_page: perPage },
  });
  return data;
}

export async function markNotificationRead(id: number): Promise<Notification> {
  const { data } = await api.post(`/notifications/${id}/read`);
  return data;
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post('/notifications/read-all');
}
