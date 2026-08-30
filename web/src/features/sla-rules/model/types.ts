export type PriorityValue = 'low' | 'normal' | 'high' | 'urgent';

export type EscalationRole = 'team_lead' | 'administrator';

/** Mirrors SlaRuleResource exactly. `breach_action_label` is server-derived. */
export type SlaRule = {
  id: number;
  priority: PriorityValue;
  priority_label: string;
  first_response_minutes: number;
  resolution_minutes: number;
  at_risk_threshold_pct: number;
  notify_on_breach: boolean;
  escalation_enabled: boolean;
  escalate_after_minutes: number | null;
  escalate_to_role: EscalationRole | null;
  auto_close_after_days: number | null;
  is_active: boolean;
  breach_action_label: string;
};

/** Urgent → Low, the order the API returns and the cards render in. */
export const PRIORITY_TIERS: PriorityValue[] = ['urgent', 'high', 'normal', 'low'];
