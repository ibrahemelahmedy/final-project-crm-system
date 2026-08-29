// TypeScript mirror of the Story 07 dashboard contract
// (07-story-agent-dashboard.md → "Shared contracts this story establishes").
// Every optional field is `| null` — JSON null is what the API sends.

import type { Ticket } from '../../tickets';

export type AgentSummary = {
  assigned_count: number;
  sla_risk_count: number;
  resolved_today_count: number;
};

export type TeamSummary = {
  team_name: string;
  agent_count: number;
  open_count: number;
  escalation_count: number;
  /** null — never 0/0 — when nothing resolved in the compliance window. */
  sla_compliance_pct: number | null;
};

export type WorkloadRow = {
  user_id: number;
  name: string;
  open_count: number;
};

/** A dashboard ticket is a TicketResource with the SLA block filled in. */
export type DashboardTicket = Ticket;

/** The escalations widget adds two dashboard-only fields. */
export type EscalationTicket = Ticket & {
  escalated_by_name: string | null;
  escalated_at: string | null;
};

export type AdminSummary = {
  user_count: number;
  active_sla_rule_count: number;
  audit_log_count: number;
};

/** Story 10 owns quick replies; this story only reads them. */
export type QuickReply = {
  id: number;
  title: string;
  body?: string | null;
};

export type Collection<T> = { data: T[] };
