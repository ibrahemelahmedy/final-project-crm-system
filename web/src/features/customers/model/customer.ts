// TypeScript mirror of contract C4 (CustomerResource). Every optional field
// is `string | null`, not `string | undefined`, because JSON null is what
// the API sends.
export type CustomerTier = 'standard' | 'premium' | 'enterprise';

export const CUSTOMER_TIERS: CustomerTier[] = ['standard', 'premium', 'enterprise'];

export type Customer = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  tier: CustomerTier;
  tier_label: string;
  initials: string;
  open_tickets_count: number;
  last_contact_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Paginated<T> = {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    pending_story?: string;
  };
};

export type CustomerFacets = {
  companies: { value: string; count: number }[];
  tiers: { value: CustomerTier; label: string; count: number }[];
  total: number;
};

export type CustomerNote = {
  id: number;
  body: string;
  author: { id: number | null; name: string };
  created_at: string;
};

export type CustomerAttachment = {
  id: number;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  size_label: string;
  uploaded_by: { id: number; name: string } | null;
  created_at: string;
  download_url: string;
};

export type Ticket = {
  id: number;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
};

export type DuplicateCustomerError = {
  message: string;
  errors?: Record<string, string[]>;
  duplicate_customer_id?: number;
  duplicate_customer_name?: string;
};
