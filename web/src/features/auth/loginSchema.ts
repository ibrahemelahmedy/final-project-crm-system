import { z } from 'zod';

/**
 * Story 16 (WIS-17): `t` is required, not optional — an optional translator
 * with an English default is exactly the shape that kept untranslated
 * fallback copy alive in a "migrated" feature (see
 * `sla-rules/model/formatDuration.ts`). Callers always have the `auth`
 * namespace's `t` available, so there is no legitimate call site without one.
 */
export function createLoginSchema(t: (key: string) => string) {
  return z.object({
    email: z.string().min(1, t('validation.emailRequired')).email(t('validation.emailInvalid')),
    password: z.string().min(1, t('validation.passwordRequired')),
  });
}

export type LoginValues = z.infer<ReturnType<typeof createLoginSchema>>;
