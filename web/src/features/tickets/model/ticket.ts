// The TypeScript mirror of TicketResource, hand-written against the
// "Shared contracts this story establishes" section of the Story 04 plan.
// Every optional field is `| null`, not `| undefined` — JSON null is what the
// API sends.

export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed';
export type TicketChannel = 'email' | 'whatsapp' | 'chat' | 'sms' | 'web_form';

/** Story 06 fills these values. The shape does not change then. */
export type SlaRisk = 'breached' | 'at_risk' | 'ok' | null;

export type TicketSla = {
  due_at: string | null;
  minutes_left: number | null;
  risk: SlaRisk;
};

export type TicketParty = { id: number; name: string };
export type TicketAssignee = { id: number; name: string; initials: string };

export type Ticket = {
  id: number;
  /** "#4821" — built server-side so the SPA never string-builds it. */
  reference: string;
  subject: string;
  description: string | null;
  status: TicketStatus;
  status_label: string;
  priority: TicketPriority;
  priority_label: string;
  category: string;
  category_label: string;
  channel: TicketChannel;
  channel_label: string;
  customer: TicketParty | null;
  /** Never carries email — guarded server-side by a column-limited eager load. */
  assignee: TicketAssignee | null;
  created_by: TicketParty | null;
  sla: TicketSla;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Laravel's own AnonymousResourceCollection envelope. Do not unwrap it in the
 * API layer — the pagination footer reads `from`, `to`, `total` and
 * `last_page` straight from `meta` rather than recomputing them.
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

export type TicketEvent = {
  id: number;
  event: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  actor: TicketParty | null;
  created_at: string;
};

export type Option = { value: string; label: string };

export type TicketMeta = {
  priorities: Option[];
  statuses: Option[];
  channels: Option[];
  categories: Option[];
  agents: Option[];
  /** Story 05 additive key — a static map from TicketStatus::allowedTransitions(). */
  transitions?: Record<TicketStatus, TicketStatus[]>;
};

export type BulkResult = {
  applied: number[];
  skipped: { id: number; reason: string }[];
};
