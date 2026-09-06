import { z } from 'zod';

// Mirrors StoreTicketTaskRequest. `assignee_id` is nullable in the form —
// an unset value means "default to me", resolved server-side.
//
// Story 16 (WIS-17): `t` is required, not optional (see
// sla-rules/model/slaRuleSchema.ts).
export function makeTaskSchema(t: (key: string) => string) {
  return z.object({
    title: z.string().trim().min(1, t('schema.taskDescriptionRequired')).max(255),
    due_at: z.string().trim().nullable().optional(),
    assignee_id: z.number().int().nullable().optional(),
  });
}

export type TaskFormValues = z.infer<ReturnType<typeof makeTaskSchema>>;
