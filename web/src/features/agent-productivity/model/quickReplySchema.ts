import { z } from 'zod';

// Single source of truth for both the create/edit form and its validation —
// mirrors StoreQuickReplyRequest / UpdateQuickReplyRequest server-side.
export const quickReplySchema = z.object({
  title: z.string().trim().min(1, 'Give this template a title.').max(255),
  body: z.string().trim().min(1, 'Write the reply body.').max(10000),
  category: z.string().trim().min(1, 'Choose a category.').max(100),
});

export type QuickReplyFormValues = z.infer<typeof quickReplySchema>;
