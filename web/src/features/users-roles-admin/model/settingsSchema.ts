import { z } from 'zod';
import type { SystemSetting } from './adminUser';

// Built from the server's own metadata (each setting ships its min/max), so
// the client can never drift from SystemSettings::definitions(). The client
// check is a CONVENIENCE — the server validates every value again, which is
// what the "min length can never be 0" criterion actually rests on.
export function buildSettingsSchema(settings: SystemSetting[]) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const setting of settings) {
    let field = z.coerce
      .number({ message: `${setting.label} must be a number.` })
      .int(`${setting.label} must be a whole number.`);

    if (setting.min !== null) {
      field = field.min(setting.min, `${setting.label} cannot be lower than ${setting.min}.`);
    }
    if (setting.max !== null) {
      field = field.max(setting.max, `${setting.label} cannot be higher than ${setting.max}.`);
    }

    shape[setting.key] = field;
  }

  // The shape is built at runtime from the server's catalogue, so Zod cannot
  // infer it — every field IS a number by construction (each branch above
  // starts from z.coerce.number()), which is what this cast asserts.
  return z.object(shape) as unknown as z.ZodType<SettingsFormValues, SettingsFormValues>;
}

export type SettingsFormValues = Record<string, number>;
