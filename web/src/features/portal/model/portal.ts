export type PortalTicketCategory = 'general' | 'billing' | 'technical' | 'account' | 'feature_request';

export type PortalTicketStatus = 'open' | 'pending' | 'resolved' | 'closed';

export type PortalTicket = {
  id: number;
  subject: string;
  status: PortalTicketStatus;
  status_label: string;
  category: PortalTicketCategory;
  category_label: string;
  channel: string;
  channel_label: string;
  created_at: string;
  last_activity_at: string;
  resolved_at: string | null;
  closed_at: string | null;
  message_count: number;
  feedback_url: string | null;
};

export type PortalMessage = {
  id: number;
  author_type: 'customer' | 'agent' | 'system';
  author_name: string | null;
  body: string;
  created_at: string;
};

export type PortalTicketDetail = {
  ticket: PortalTicket;
  messages: PortalMessage[];
};

export type PortalPaginated<T> = {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    total: number;
    per_page: number;
  };
};

export type PortalArticle = {
  title: string;
  slug: string;
  excerpt: string | null;
  body_html: string | null;
  published_at: string | null;
  category: string | null;
};

export type PortalCustomer = {
  id: number;
  name: string;
  masked_identifier: string;
  expires_at?: string;
};
