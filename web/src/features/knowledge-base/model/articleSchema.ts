import { z } from 'zod';

/**
 * Two schemas, one form. Saving a DRAFT needs only a title; PUBLISHING needs
 * a title, a body, and a category — the acceptance criterion is about
 * publishing, not about saving.
 *
 * These mirror ArticleWriter::assertPublishable() on the server. The server's
 * copy is the boundary; this one exists so the editor can disable Publish and
 * name the missing field without a round trip.
 */
export const draftSchema = z.object({
  title: z.string().trim().min(1, 'A title is required.').max(255, 'Keep the title under 255 characters.'),
  body: z.string().max(100000, 'This article is too long to save.'),
  // The select's empty option is '' — not null — because a native <select>
  // value is always a string.
  kb_category_id: z.union([z.string(), z.number()]),
});

export const publishSchema = draftSchema.extend({
  body: z
    .string()
    .max(100000, 'This article is too long to save.')
    .refine((v) => v.trim().length > 0, { message: 'A body is required before this article can be published.' }),
  kb_category_id: z
    .union([z.string(), z.number()])
    .refine((v) => v !== '' && v !== null && v !== undefined, {
      message: 'A category is required before this article can be published.',
    }),
});

export type ArticleFormValues = z.infer<typeof draftSchema>;
