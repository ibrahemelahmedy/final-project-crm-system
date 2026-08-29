// TypeScript mirror of Story 08's UserResource (extended) and the admin
// list/facet contracts. Every optional field is `string | null`, not
// `string | undefined`, because JSON null is what the API sends.

export type UserRole = 'agent' | 'team_lead' | 'administrator';

// The whole role model. Story 01 owns these three cases; this feature adds no
// fourth and renames no value.
export const USER_ROLES: UserRole[] = ['agent', 'team_lead', 'administrator'];

export const ROLE_LABELS: Record<UserRole, string> = {
  agent: 'Agent',
  team_lead: 'Team Lead',
  administrator: 'Administrator',
};

export type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  role_label: string;
  home_route: string;
  is_active: boolean;
  department: string | null;
  initials: string;
  last_login_at: string | null;
};

export type UserStatusFilter = 'active' | 'inactive' | 'all';

export type Paginated<T> = {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
};

export type UserFacets = {
  roles: { value: UserRole; label: string; count: number }[];
  departments: { value: string; count: number }[];
  total: number;
  active_total: number;
  department_total: number;
};

// ---- Audit log ------------------------------------------------------------

export type AuditLogEntry = {
  id: number;
  event: string;
  event_label: string;
  actor: { id: number | null; name: string; email: string | null };
  target: { type: string | null; id: number | string | null; label: string | null };
  ip_address: string | null;
  context: Record<string, unknown> | null;
  created_at: string | null;
};

export type AuditLogFacets = {
  events: { value: string; label: string; count: number }[];
  actors: { value: number; label: string; email: string }[];
  total: number;
};

// ---- Settings -------------------------------------------------------------

export type SystemSetting = {
  key: string;
  label: string;
  type: 'integer';
  value: number;
  default: number;
  help: string;
  min: number | null;
  max: number | null;
  updated_at: string | null;
};
