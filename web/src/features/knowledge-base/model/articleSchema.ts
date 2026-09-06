import { z } from 'zod';

/**
 * Two schemas, one form. Saving a DRAFT needs only a title; PUBLISHING needs
 * a title, a body, and a category — the acceptance criterion is about
 * publishing, not about saving.
 *
 * These mirror ArticleWriter::assertPublishable() on the server. The server's
 * copy is the boundary; this one exists so the editor can disable Publish and
 * name the missing field without a round trip.
 *
 * Story 16 (WIS-17): `t` is required, not optional (see
 * sla-rules/model/slaRuleSchema.ts).
 */
export function makeDraftSchema(t: (key: string) => string) {
  return z.object({
    title: z.string().trim().min(1, t('schema.titleRequired')).max(255, t('schema.titleTooLong')),
    body: z.string().max(100000, t('schema.bodyTooLong')),
    // The select's empty option is '' — not null — because a native <select>
    // value is always a string.
    kb_category_id: z.union([z.string(), z.number()]),
  });
}

export function makePublishSchema(t: (key: string) => string) {
  return makeDraftSchema(t).extend({
    body: z
      .string()
      .max(100000, t('schema.bodyTooLong'))
      .refine((v) => v.trim().length > 0, { message: t('schema.bodyRequiredToPublish') }),
    kb_category_id: z
      .union([z.string(), z.number()])
      .refine((v) => v !== '' && v !== null && v !== undefined, {
        message: t('schema.categoryRequiredToPublish'),
      }),
  });
}

export type ArticleFormValues = z.infer<ReturnType<typeof makeDraftSchema>>;
