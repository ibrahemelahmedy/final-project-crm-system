import { z } from 'zod';

// Single source of truth for both the create/edit form and its validation —
// mirrors StoreQuickReplyRequest / UpdateQuickReplyRequest server-side.
//
// Story 16 (WIS-17): `t` is required, not optional (see
// sla-rules/model/slaRuleSchema.ts).
export function makeQuickReplySchema(t: (key: string) => string) {
  return z.object({
    title: z.string().trim().min(1, t('schema.titleRequired')).max(255),
    body: z.string().trim().min(1, t('schema.bodyRequired')).max(10000),
    category: z.string().trim().min(1, t('schema.categoryRequired')).max(100),
  });
}

export type QuickReplyFormValues = z.infer<ReturnType<typeof makeQuickReplySchema>>;
