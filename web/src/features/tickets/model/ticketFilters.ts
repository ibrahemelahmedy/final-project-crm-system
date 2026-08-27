import { z } from 'zod';

/** The closed sort set. Mirrors the server-side whitelist in Ticket::scopeSorted. */
export const SORTABLE = ['id', 'customer', 'priority', 'status', 'updated_at'] as const;

export const PAGE_SIZES = [10, 25, 50] as const;

/**
 * The zod schema is the single source of both the parsing rule and the type.
 *
 * Parse with `safeParse`, never `parse` — a hand-edited URL such as
 * `?priority[]=critical` must render the unfiltered queue, not crash the
 * route. There is no error boundary above TicketQueuePage.
 */
export const ticketFiltersSchema = z.object({
  status: z.array(z.enum(['open', 'pending', 'resolved', 'closed'])).default([]),
  priority: z.array(z.enum(['low', 'normal', 'high', 'urgent'])).default([]),
  channel: z.array(z.enum(['email', 'whatsapp', 'chat', 'sms', 'web_form'])).default([]),
  category: z.array(z.string()).default([]),
  // User ids as strings, plus the literal 'unassigned' sentinel. Strings keep
  // one filter concept in one URL key without a union at every call site.
  assigned_to: z.array(z.string()).default([]),
  q: z.string().trim().default(''),
  sort: z.string().default('-created_at'),
  page: z.coerce.number().int().min(1).default(1),
  // Coerced before the literal union, because a URL always hands over the
  // string "50", which z.literal(50) would reject.
  per_page: z
    .preprocess(
      (v) => (v === undefined || v === null || v === '' ? undefined : Number(v)),
      z.union([z.literal(10), z.literal(25), z.literal(50)])
    )
    .default(25),
});

export type TicketFilters = z.infer<typeof ticketFiltersSchema>;

export const DEFAULT_FILTERS: TicketFilters = ticketFiltersSchema.parse({});

/** The facet keys — sort/page/per_page are navigation, not filters. */
export const FACET_KEYS = ['status', 'priority', 'channel', 'category', 'assigned_to'] as const;
export type FacetKey = (typeof FACET_KEYS)[number];

/**
 * Parses raw URL input, falling back to the defaults for anything malformed
 * rather than throwing. Per-field recovery: one bad facet must not discard the
 * others, so each array is filtered against its own schema before the whole
 * object is parsed.
 */
export function parseTicketFilters(raw: Record<string, unknown>): TicketFilters {
  const whole = ticketFiltersSchema.safeParse(raw);
  if (whole.success) return whole.data;

  // Salvage field by field so a single invalid value does not reset the view.
  const salvaged: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const shape = ticketFiltersSchema.shape as Record<string, z.ZodTypeAny>;
    const field = shape[key];
    if (!field) continue;
    const attempt = field.safeParse(value);
    if (attempt.success) {
      salvaged[key] = attempt.data;
      continue;
    }
    // An array facet keeps the members that do parse. Each candidate is tested
    // as a single-element array against the field's own schema, so no
    // introspection of the ZodDefault/ZodArray wrapper is needed.
    if (Array.isArray(value)) {
      const kept = value.filter((v) => field.safeParse([v]).success);
      if (kept.length) salvaged[key] = kept;
    }
  }

  const second = ticketFiltersSchema.safeParse(salvaged);
  return second.success ? second.data : DEFAULT_FILTERS;
}

/** True when the user has narrowed the queue in any way the empty state should name. */
export function countActiveFacets(filters: TicketFilters): number {
  let count = 0;
  for (const key of FACET_KEYS) {
    if (filters[key].length > 0) count += 1;
  }
  if (filters.q.trim() !== '') count += 1;
  return count;
}
