import { useQuery } from '@tanstack/react-query';
import { fetchUnreadCount } from '../api/notificationsApi';
import { notificationKeys } from '../api/queryKeys';

/**
 * MVP delivery is POLLING, not WebSocket push — a deliberate decision (see
 * the Story 11 plan's "Delivery-mechanism decision"). 45s sits inside the
 * plan's stated 30–120s window: soon enough that an SLA breach shows up
 * within one interval of it landing, without hammering the endpoint from
 * every open tab.
 */
export const UNREAD_COUNT_POLL_INTERVAL_MS = 45_000;

/**
 * Server state — this is the bell's ONLY source of truth. It does not live in
 * the global store (that holds user and theme only), so a full page refresh
 * always reflects the server, never a stale client value.
 */
export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: fetchUnreadCount,
    refetchInterval: UNREAD_COUNT_POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });
}
