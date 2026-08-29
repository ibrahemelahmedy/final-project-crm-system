import { z } from 'zod';

// Mirrors StoreTicketTaskRequest. `assignee_id` is nullable in the form —
// an unset value means "default to me", resolved server-side.
export const taskSchema = z.object({
  title: z.string().trim().min(1, 'Describe the task.').max(255),
  due_at: z.string().trim().nullable().optional(),
  assignee_id: z.number().int().nullable().optional(),
});

export type TaskFormValues = z.infer<typeof taskSchema>;
