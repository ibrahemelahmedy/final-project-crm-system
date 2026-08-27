import { z } from 'zod';

/**
 * Validates shape only. Whether the actor may assign, which statuses are
 * reachable, and whether the customer exists are SERVER rules — the client
 * check is a courtesy, never the enforcement.
 */
export const newTicketSchema = z.object({
  subject: z.string().trim().min(1, 'Subject is required').max(255),
  customer_id: z.number({ message: 'Select a customer' }).int().positive(),
  category: z.string().min(1, 'Select a category'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  channel: z.enum(['email', 'whatsapp', 'chat', 'sms', 'web_form']),
  description: z.string().max(5000).optional(),
});

export type NewTicketValues = z.infer<typeof newTicketSchema>;
