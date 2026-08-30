import { z } from 'zod';

/**
 * The single source for both the form's TypeScript type and its validation,
 * mirroring StoreSlaRuleRequest exactly.
 *
 * Both `refine` messages are BYTE-IDENTICAL to the server's. A user who
 * defeats the client check sees the same sentence back from the API, not a
 * second phrasing of the same rule.
 */
export const slaRuleSchema = z
  .object({
    priority: z.enum(['low', 'normal', 'high', 'urgent']),
    first_response_minutes: z.number().int().min(1).max(525600),
    resolution_minutes: z.number().int().min(1).max(525600),
    at_risk_threshold_pct: z.number().int().min(1).max(99),
    notify_on_breach: z.boolean(),
    escalation_enabled: z.boolean(),
    escalate_after_minutes: z.number().int().min(1).max(525600).nullable(),
    escalate_to_role: z.enum(['team_lead', 'administrator']).nullable(),
    auto_close_after_days: z.number().int().min(1).max(365).nullable(),
    is_active: z.boolean(),
  })
  .refine((v) => v.resolution_minutes > v.first_response_minutes, {
    path: ['resolution_minutes'],
    message: 'The resolution target must be longer than the response target.',
  })
  .refine((v) => !v.escalation_enabled || v.escalate_to_role !== null, {
    path: ['escalate_to_role'],
    message: 'Choose who the ticket escalates to.',
  });

export type SlaRuleInput = z.infer<typeof slaRuleSchema>;
