import { z } from 'zod';

/**
 * Validates shape only. Whether the actor may assign, which statuses are
 * reachable, and whether the customer exists are SERVER rules — the client
 * check is a courtesy, never the enforcement.
 *
 * Story 16 (WIS-17): `t` is required, not optional.
 */
export function createNewTicketSchema(t: (key: string) => string) {
  return z.object({
    subject: z.string().trim().min(1, t('newTicket.subjectRequired')).max(255),
    customer_id: z.number({ message: t('newTicket.customerRequired') }).int().positive(),
    category: z.string().min(1, t('newTicket.selectCategory')),
    priority: z.enum(['low', 'normal', 'high', 'urgent']),
    channel: z.enum(['email', 'whatsapp', 'chat', 'sms', 'web_form']),
    description: z.string().max(5000).optional(),
  });
}

export type NewTicketValues = z.infer<ReturnType<typeof createNewTicketSchema>>;
