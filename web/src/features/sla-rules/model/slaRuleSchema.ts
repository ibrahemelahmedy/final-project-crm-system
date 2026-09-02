import { z } from 'zod';

/**
 * The single source for both the form's TypeScript type and its validation,
 * mirroring StoreSlaRuleRequest exactly.
 *
 * Both `refine` messages' ENGLISH values are BYTE-IDENTICAL to the server's
 * (`api/app/Http/Requests/{Store,Update}SlaRuleRequest.php`). A user who
 * defeats the client check sees the same sentence back from the API, not a
 * second phrasing of the same rule. The server has no Arabic counterpart for
 * these two messages yet (WIS-17 does not touch `api/`) — the Arabic value
 * below is this story's contribution, not a mirrored server string.
 *
 * Story 16 (WIS-17): `t` is required, not optional — an optional translator
 * with an English default is exactly the shape that kept untranslated
 * fallback copy alive in a "migrated" feature (see `model/formatDuration.ts`).
 */
export function createSlaRuleSchema(t: (key: string) => string) {
  return z
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
      message: t('validation.resolutionAfterResponse'),
    })
    .refine((v) => !v.escalation_enabled || v.escalate_to_role !== null, {
      path: ['escalate_to_role'],
      message: t('validation.escalateToRequired'),
    });
}

export type SlaRuleInput = z.infer<ReturnType<typeof createSlaRuleSchema>>;
