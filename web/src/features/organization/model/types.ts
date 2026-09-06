export type Branch = {
  id: number;
  name: string;
  region: string | null;
  timezone: string;
  is_active: boolean;
  agent_count: number;
  created_at: string | null;
};

export type Department = {
  id: number;
  branch_id: number;
  branch_name: string | null;
  name: string;
  is_active: boolean;
  agent_count: number;
  created_at: string | null;
};

export type Branding = {
  primary_color: string | null;
  logo_url: string | null;
  updated_at: string | null;
};
