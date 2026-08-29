import type { TicketChannel } from './ticket';

export type MessageAuthorType = 'customer' | 'agent' | 'system';
/** Story 10. `internal` never reaches a customer-facing render path (server-enforced in the query). */
export type MessageVisibility = 'public' | 'internal';

export type MessageAuthor = { id: number; name: string; initials: string };
export type MessageMention = { id: number; name: string };

export type TicketMessage = {
  id: number;
  ticket_id: number;
  author_type: MessageAuthorType;
  author: MessageAuthor | null; // null = system, or a deleted user/customer
  is_mine: boolean;
  channel: TicketChannel;
  channel_label: string;
  body: string;
  visibility: MessageVisibility;
  mentions?: MessageMention[];
  created_at: string;
};

/** Laravel's cursor envelope — NOT the `Paginated<T>` shape the queue uses. */
export type CursorPaginated<T> = {
  data: T[];
  links: { first: string | null; last: string | null; prev: string | null; next: string | null };
  meta: {
    path: string;
    per_page: number;
    next_cursor: string | null;
    prev_cursor: string | null;
  };
};
