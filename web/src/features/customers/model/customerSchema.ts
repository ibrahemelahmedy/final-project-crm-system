import { z } from 'zod';

export const customerSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(255),
    email: z.string().email('Enter a valid email address').max(255).or(z.literal('')),
    phone: z.string().max(32).or(z.literal('')),
    company: z.string().max(255).or(z.literal('')),
    tier: z.enum(['standard', 'premium', 'enterprise']),
  })
  // The cross-field error lands on `email` — the same field the backend
  // attaches its copy of this error to, so client and server render
  // identically.
  .refine((v) => v.email.trim() !== '' || v.phone.trim() !== '', {
    message: 'Add an email address or a phone number.',
    path: ['email'],
  });

export type CustomerFormValues = z.infer<typeof customerSchema>;
