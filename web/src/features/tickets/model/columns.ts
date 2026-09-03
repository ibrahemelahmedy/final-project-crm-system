import type { SORTABLE } from './ticketFilters';

export type SortKey = (typeof SORTABLE)[number];

export type QueueColumn = {
  id: string;
  /** i18n key in the `tickets` namespace, under `columns.*`. */
  labelKey: string;
  sortKey?: SortKey;
  /** Rendered visually hidden — the select and channel columns have no visible label. */
  hiddenLabel?: boolean;
};

/**
 * Column order: select · channel · ID · SUBJECT · CUSTOMER · PRIORITY ·
 * STATUS · ASSIGNEE · SLA LEFT.
 *
 * ASSIGNEE is the ninth column this story adds over the export's eight — the
 * export depicts an Agent's OWN queue, where an assignee column is redundant,
 * but a Team Lead needs it.
 *
 * SUBJECT, ASSIGNEE and SLA LEFT are not sortable: the export gives SUBJECT no
 * affordance, and there is nothing to sort SLA on until Story 06.
 *
 * Lives outside the component file so a Fast Refresh boundary is not broken by
 * a non-component export.
 */
export const COLUMNS: QueueColumn[] = [
  { id: 'select', labelKey: 'columns.select', hiddenLabel: true },
  { id: 'channel', labelKey: 'columns.channel', hiddenLabel: true },
  { id: 'id', labelKey: 'columns.id', sortKey: 'id' },
  { id: 'subject', labelKey: 'columns.subject' },
  { id: 'customer', labelKey: 'columns.customer', sortKey: 'customer' },
  { id: 'priority', labelKey: 'columns.priority', sortKey: 'priority' },
  { id: 'status', labelKey: 'columns.status', sortKey: 'status' },
  { id: 'assignee', labelKey: 'columns.assignee' },
  { id: 'sla', labelKey: 'columns.slaLeft' },
];
