// The TypeScript mirror of NotificationResource, hand-written against the
// "Shared contracts this story establishes" section of the Story 11 plan.

export type NotificationType = 'sla_at_risk' | 'sla_breached' | 'mention' | 'task_due';
export type NotificationTone = 'warning' | 'danger' | 'info' | 'success';
export type NotificationFilter = 'unread' | 'all';

export type Notification = {
  id: number;
  type: NotificationType;
  type_label: string;
  tone: NotificationTone;
  title: string;
  body: string | null;
  /**
   * Omitted (null) whenever `source_available` is false — the client must
   * never navigate on a "no longer available" row.
   */
  link_to: string | null;
  source_available: boolean;
  read_at: string | null;
  created_at: string;
};

/**
 * Laravel's own AnonymousResourceCollection envelope — mirrors
 * `web/src/features/tickets/model/ticket.ts`'s `Paginated<T>`.
 */
export type Paginated<T> = {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    from: number | null;
    to: number | null;
    total: number;
  };
  links: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
};
