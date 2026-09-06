import { z } from 'zod';

/**
 * The single source for both the form's TypeScript type and its validation,
 * mirroring web/src/features/sla-rules/model/slaRuleSchema.ts.
 *
 * `t` is required, not optional — an optional translator with an English
 * default is exactly the shape that kept untranslated fallback copy alive
 * elsewhere in the app (see sla-rules' formatDuration.ts docblock).
 *
 * `requireSecret` is `true` when connecting for the first time and `false`
 * when reconfiguring — the client mirror of the server's `nullable` rule in
 * SaveIntegrationRequest (Decision 4: an empty secret on Configure means
 * "keep the stored one").
 */
export function createIntegrationSchema(t: (key: string) => string, requireSecret: boolean) {
  return z.object({
    endpoint_url: z
      .string()
      .url()
      .startsWith('https://', { message: t('error.scheme') }),
    secret: requireSecret
      ? z.string().min(8).max(512)
      : z.string().min(8).max(512).or(z.literal('')),
  });
}

export type IntegrationInput = z.infer<ReturnType<typeof createIntegrationSchema>>;
