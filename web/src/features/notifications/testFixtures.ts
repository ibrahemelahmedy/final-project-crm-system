import type { Notification, Paginated } from './model/notification';

export function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 1,
    type: 'sla_at_risk',
    type_label: 'SLA at risk',
    tone: 'warning',
    title: '#4821 "Payment not going through" is approaching its resolution deadline.',
    body: null,
    link_to: '/tickets/4821',
    source_available: true,
    read_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function makePage(
  data: Notification[],
  overrides: Partial<Paginated<Notification>['meta']> = {}
): Paginated<Notification> {
  return {
    data,
    meta: {
      current_page: 1,
      last_page: 1,
      per_page: 20,
      from: data.length ? 1 : null,
      to: data.length,
      total: data.length,
      ...overrides,
    },
    links: { first: null, last: null, prev: null, next: null },
  };
}
