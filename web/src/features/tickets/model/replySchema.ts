import { z } from 'zod';

// `.trim()` runs before `.min(1)`, mirroring the server's prepareForValidation().
// The message string is identical on both sides so a user never sees two
// different wordings for the same refusal.
export const replySchema = z.object({
  body: z.string().trim().min(1, 'Write a reply before sending.').max(10000),
});

export type ReplyValues = z.infer<typeof replySchema>;
