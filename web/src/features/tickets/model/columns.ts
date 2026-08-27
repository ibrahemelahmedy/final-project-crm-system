import type { SORTABLE } from './ticketFilters';

export type SortKey = (typeof SORTABLE)[number];

export type QueueColumn = {
  id: string;
  label: string;
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
  { id: 'select', label: 'Select', hiddenLabel: true },
  { id: 'channel', label: 'Channel', hiddenLabel: true },
  { id: 'id', label: 'ID', sortKey: 'id' },
  { id: 'subject', label: 'Subject' },
  { id: 'customer', label: 'Customer', sortKey: 'customer' },
  { id: 'priority', label: 'Priority', sortKey: 'priority' },
  { id: 'status', label: 'Status', sortKey: 'status' },
  { id: 'assignee', label: 'Assignee' },
  { id: 'sla', label: 'SLA left' },
];
