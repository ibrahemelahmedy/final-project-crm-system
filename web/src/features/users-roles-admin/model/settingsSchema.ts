import { z } from 'zod';
import type { SystemSetting } from './adminUser';

/**
 * Built from the server's own metadata (each setting ships its min/max), so
 * the client can never drift from SystemSettings::definitions(). The client
 * check is a CONVENIENCE — the server validates every value again, which is
 * what the "min length can never be 0" criterion actually rests on.
 *
 * Story 16 (WIS-17): `t` is required, not optional (see
 * sla-rules/model/slaRuleSchema.ts) — every message interpolates the
 * server-supplied `setting.label` into a translated sentence rather than
 * concatenating English prose around it.
 */
export function buildSettingsSchema(settings: SystemSetting[], t: (key: string, opts: Record<string, unknown>) => string) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const setting of settings) {
    let field = z.coerce
      .number({ message: t('settingsSchema.mustBeNumber', { label: setting.label }) })
      .int(t('settingsSchema.mustBeInteger', { label: setting.label }));

    if (setting.min !== null) {
      field = field.min(setting.min, t('settingsSchema.tooLow', { label: setting.label, min: setting.min }));
    }
    if (setting.max !== null) {
      field = field.max(setting.max, t('settingsSchema.tooHigh', { label: setting.label, max: setting.max }));
    }

    shape[setting.key] = field;
  }

  // The shape is built at runtime from the server's catalogue, so Zod cannot
  // infer it — every field IS a number by construction (each branch above
  // starts from z.coerce.number()), which is what this cast asserts.
  return z.object(shape) as unknown as z.ZodType<SettingsFormValues, SettingsFormValues>;
}

export type SettingsFormValues = Record<string, number>;
