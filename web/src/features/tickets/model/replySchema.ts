import { z } from 'zod';

// `.trim()` runs before `.min(1)`, mirroring the server's prepareForValidation().
// The message string is identical on both sides so a user never sees two
// different wordings for the same refusal.
//
// Story 16 (WIS-17): `t` is required — the caller passes a `conversation`-namespace
// translator so the refusal is localized.
export function createReplySchema(t: (key: string) => string) {
  return z.object({
    body: z.string().trim().min(1, t('composer.replyRequired')).max(10000),
  });
}

export type ReplyValues = z.infer<ReturnType<typeof createReplySchema>>;
