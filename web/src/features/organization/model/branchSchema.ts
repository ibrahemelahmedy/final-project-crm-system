import { z } from 'zod';

/**
 * `t` is required, not optional — mirrors
 * web/src/features/integrations/model/integrationSchema.ts's reasoning: an
 * optional translator with an English default is exactly the shape that
 * kept untranslated fallback copy alive elsewhere in the app.
 */
export function createBranchSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().trim().min(1, { message: t('branches.error.nameRequired') }).max(120),
    region: z.string().trim().max(120),
    timezone: z.string().min(1),
    is_active: z.boolean(),
  });
}

export type BranchFormValues = z.infer<ReturnType<typeof createBranchSchema>>;

/** A short curated list, not Intl.supportedValuesOf('timeZone')'s ~400 entries. */
export const TIMEZONE_OPTIONS: { value: string; labelKey: string }[] = [
  { value: 'Asia/Riyadh', labelKey: 'timezones.riyadh' },
  { value: 'Asia/Dubai', labelKey: 'timezones.dubai' },
  { value: 'Africa/Cairo', labelKey: 'timezones.cairo' },
  { value: 'Europe/Istanbul', labelKey: 'timezones.istanbul' },
  { value: 'Europe/London', labelKey: 'timezones.london' },
  { value: 'America/New_York', labelKey: 'timezones.newYork' },
  { value: 'America/Los_Angeles', labelKey: 'timezones.losAngeles' },
  { value: 'UTC', labelKey: 'timezones.utc' },
];
