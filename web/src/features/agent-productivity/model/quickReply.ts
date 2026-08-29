// TypeScript mirror of QuickReplyResource / TicketQuickReplyResource.

export type QuickReplyStatus = 'active' | 'archived';

export type QuickReply = {
  id: number;
  title: string;
  body: string;
  preview: string;
  category: string;
  status: QuickReplyStatus;
  status_label: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

/** The picker's shape — GET /api/tickets/{ticket}/quick-replies. */
export type TicketQuickReply = {
  id: number;
  title: string;
  category: string;
  body_template: string;
  body_rendered: string;
};
