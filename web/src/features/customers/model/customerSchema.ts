import { z } from 'zod';

/**
 * Story 16 (WIS-17): `t` is required, not optional — an optional translator
 * with an English default is exactly the shape that kept untranslated
 * fallback copy alive in a "migrated" feature (see sla-rules/model/slaRuleSchema.ts).
 */
export function makeCustomerSchema(t: (key: string) => string) {
  return z
    .object({
      name: z.string().min(1, t('schema.nameRequired')).max(255),
      email: z.string().email(t('schema.emailInvalid')).max(255).or(z.literal('')),
      phone: z.string().max(32).or(z.literal('')),
      company: z.string().max(255).or(z.literal('')),
      tier: z.enum(['standard', 'premium', 'enterprise']),
    })
    // The cross-field error lands on `email` — the same field the backend
    // attaches its copy of this error to, so client and server render
    // identically.
    .refine((v) => v.email.trim() !== '' || v.phone.trim() !== '', {
      message: t('schema.contactRequired'),
      path: ['email'],
    });
}

export type CustomerFormValues = z.infer<ReturnType<typeof makeCustomerSchema>>;
