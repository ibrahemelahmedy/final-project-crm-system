import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notificationsApi';
import { notificationKeys } from '../api/queryKeys';
import type { NotificationFilter } from '../model/notification';

export function useNotificationsList(filter: NotificationFilter, page: number) {
  return useQuery({
    queryKey: notificationKeys.list(filter, page),
    queryFn: () => fetchNotifications(filter, page),
    placeholderData: keepPreviousData,
  });
}

/**
 * Activating a row marks it read. The badge decrements optimistically —
 * rolled back on failure — and both the count and every list query are
 * invalidated afterwards so the panel and the full page reconcile.
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => markNotificationRead(id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.unreadCount() });
      const previousCount = queryClient.getQueryData<number>(notificationKeys.unreadCount());
      if (typeof previousCount === 'number') {
        queryClient.setQueryData(notificationKeys.unreadCount(), Math.max(0, previousCount - 1));
      }
      return { previousCount };
    },
    onError: (_err, _id, context) => {
      if (context && typeof context.previousCount === 'number') {
        queryClient.setQueryData(notificationKeys.unreadCount(), context.previousCount);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAllNotificationsRead,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.unreadCount() });
      const previousCount = queryClient.getQueryData<number>(notificationKeys.unreadCount());
      queryClient.setQueryData(notificationKeys.unreadCount(), 0);
      return { previousCount };
    },
    onError: (_err, _vars, context) => {
      if (context && typeof context.previousCount === 'number') {
        queryClient.setQueryData(notificationKeys.unreadCount(), context.previousCount);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
